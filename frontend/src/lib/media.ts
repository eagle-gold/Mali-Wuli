const origineBackend = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";
  return apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
};

export function urlMediaBackend(url?: string | null) {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${origineBackend()}${url.startsWith("/") ? "" : "/"}${url}`;
}
