import client from "./client";

const BASE = "/api/v1/mentor/certifications";

/** Fetch all certifications for the logged-in mentor */
export async function listMyCertifications() {
  const res = await client.get(BASE);
  return res?.data?.data || [];
}

/** Fetch public certifications for any mentor by ID */
export async function listCertifications(mentorId) {
  const res = await client.get(`${BASE}/${mentorId}`);
  return res?.data?.data || [];
}

/** Create a new certification */
export async function createCertification(payload) {
  const res = await client.post(BASE, payload);
  return res?.data?.data;
}

/** Update an existing certification */
export async function updateCertification(id, payload) {
  const res = await client.put(`${BASE}/${id}`, payload);
  return res?.data?.data;
}

/** Delete a certification */
export async function deleteCertification(id) {
  const res = await client.delete(`${BASE}/${id}`);
  return res?.data?.data;
}
