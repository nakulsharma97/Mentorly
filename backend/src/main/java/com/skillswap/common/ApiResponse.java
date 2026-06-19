package com.skillswap.common;

public record ApiResponse<T>(String message, T data) {
}
