import client from "./client";

const BASE = "/api/v1/users/me/projects";

/** Fetch all projects for the logged-in user */
export async function listMyProjects() {
  const res = await client.get(BASE);
  return res?.data?.data || [];
}

/** Create a new project */
export async function createProject(payload) {
  const res = await client.post(BASE, payload);
  return res?.data?.data;
}

/** Update an existing project */
export async function updateProject(id, payload) {
  const res = await client.put(`${BASE}/${id}`, payload);
  return res?.data?.data;
}

/** Delete a project */
export async function deleteProject(id) {
  const res = await client.delete(`${BASE}/${id}`);
  return res?.data?.data;
}
