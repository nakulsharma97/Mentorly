package com.skillswap.files;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
@Slf4j
public class FileUploadController {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResponse> uploadFile(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file) {
        if (user == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required and must not be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size must not exceed 10 MB");
        }

        String originalFilename = file.getOriginalFilename() == null ? "file"
                : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        log.info("Uploading file: name={}, size={}, contentType={}", originalFilename, file.getSize(), contentType);

        String storedPath = storeFile(file, originalFilename, contentType);
        String publicUrl = storedPath;

        return new ApiResponse<>("File uploaded successfully", new FileUploadResponse(publicUrl, originalFilename, file.getSize()));
    }

    /**
     * Store the uploaded file to disk and return the public URL path.
     * Allowed types: images (JPEG, PNG, GIF, WebP), documents (PDF, DOC, DOCX, TXT),
     * audio (WebM, MP3, WAV, OGG, M4A), and common web formats (JSON, CSV).
     * SVG is deliberately excluded — it can carry embedded scripts (stored XSS).
     */
    private String storeFile(MultipartFile file, String originalFilename, String contentType) {
        boolean isAllowed = isAllowedFileType(originalFilename, contentType);
        if (!isAllowed) {
            throw new IllegalArgumentException("File type not allowed. Supported types: images, documents, audio, and common web formats.");
        }

        try {
            Path uploadDir = Paths.get("uploads", "chat");
            Files.createDirectories(uploadDir);

            String extension = "";
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex > 0 && dotIndex < originalFilename.length() - 1) {
                extension = originalFilename.substring(dotIndex);
            }
            if (extension.isEmpty()) {
                // Infer extension from content type
                extension = inferExtension(contentType);
            }

            // Defense in depth: keep only alphanumeric + a leading dot so a
            // crafted filename can never inject path separators into the path.
            String sanitized = extension.replaceAll("[^a-zA-Z0-9.]", "");
            String storedName = UUID.randomUUID() + sanitized;
            Path target = uploadDir.resolve(storedName);

            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            }

            log.info("File stored at: {}", target.toAbsolutePath());
            return "/uploads/chat/" + storedName;
        } catch (IOException ex) {
            log.error("Failed to store file: {}", originalFilename, ex);
            throw new IllegalArgumentException("Could not upload file. Storage error occurred.", ex);
        }
    }

    private boolean isAllowedFileType(String filename, String contentType) {
        String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.')) : "";

        // Step 1: Block known dangerous extensions regardless of content-type
        if (isBlockedExtension(ext)) return false;

        // Step 2: Check if extension is allowed
        boolean extAllowed = isAllowedExtension(ext);

        // Step 3: Check if content-type is allowed
        boolean ctAllowed = isAllowedContentType(contentType);

        // Step 4: Both must be consistent
        // - If both are present, both must be allowed
        // - If extension is missing (no dot), rely on content-type
        // - If content-type is unknown/octet-stream, rely on extension
        if (extAllowed && ctAllowed) return true;
        if (extAllowed && (contentType.isEmpty() || contentType.equals("application/octet-stream"))) return true;
        if (ctAllowed && ext.isEmpty()) return true;

        log.warn("File type not allowed: ext={}, contentType={}", ext, contentType);
        return false;
    }

    private boolean isBlockedExtension(String ext) {
        return switch (ext) {
            case ".exe", ".bat", ".sh", ".msi", ".dll", ".com", ".cmd", ".vbs", ".ps1", ".scr" -> true;
            case ".zip", ".rar", ".gz", ".7z", ".tar" -> true; // archives blocked for security
            case ".jar", ".war", ".class" -> true; // executables
            default -> false;
        };
    }

    private boolean isAllowedExtension(String ext) {
        return switch (ext) {
            case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" -> true;
            case ".pdf", ".doc", ".docx", ".txt", ".csv", ".json", ".xml" -> true;
            case ".mp3", ".wav", ".ogg", ".m4a", ".webm", ".flac" -> true;
            case ".mp4", ".mov", ".avi", ".mkv" -> true;
            default -> false;
        };
    }

    private boolean isAllowedContentType(String contentType) {
        // SVG is never allowed — it can embed executable scripts (stored XSS).
        if (contentType.equals("image/svg+xml") || contentType.equals("image/svg")) {
            return false;
        }
        return contentType.startsWith("image/")
                || contentType.startsWith("audio/")
                || contentType.startsWith("video/")
                || contentType.equals("application/pdf")
                || contentType.equals("text/plain")
                || contentType.equals("text/csv")
                || contentType.equals("application/json")
                || contentType.equals("application/xml")
                || contentType.equals("text/xml");
    }

    private String inferExtension(String contentType) {
        if (contentType == null || contentType.isBlank()) return ".bin";
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "application/pdf" -> ".pdf";
            case "text/plain" -> ".txt";
            case "text/csv" -> ".csv";
            case "application/json" -> ".json";
            case "audio/webm" -> ".webm";
            case "audio/mpeg" -> ".mp3";
            case "audio/wav" -> ".wav";
            case "audio/ogg" -> ".ogg";
            case "audio/mp4" -> ".m4a";
            case "video/mp4" -> ".mp4";
            default -> ".bin";
        };
    }

    public record FileUploadResponse(String url, String originalName, long size) {
    }
}
