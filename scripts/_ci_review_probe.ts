// Throwaway probe to verify the Claude reviewer flags our risk patterns.
// Delete with the test PR.
export async function probe(userUrl: string): Promise<string> {
  // Deliberately a bare fetch() of a user-controlled URL — this is the
  // SSRF pattern the reviewer is told to flag (should use safeFetchHtml).
  const res = await fetch(userUrl);
  return res.text();
}
