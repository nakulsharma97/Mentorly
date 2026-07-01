import client from "./client";

const BASE = "/api/mentor/certifications";

// Public: fetch all professional certifications for a mentor (works logged-out).
export async function listCertifications(mentorId) {
  const res = await client.get(`${BASE}/${mentorId}`);
  return res?.data?.data || [];
}

// Owner only: create a certification.
export async function createCertification(payload) {
  const res = await client.post(BASE, payload);
  return res?.data?.data;
}

// Owner only: update a certification.
export async function updateCertification(id, payload) {
  const res = await client.put(`${BASE}/${id}`, payload);
  return res?.data?.data;
}

// Owner only: delete a certification.
export async function deleteCertification(id) {
  const res = await client.delete(`${BASE}/${id}`);
  return res?.data?.data;
}
