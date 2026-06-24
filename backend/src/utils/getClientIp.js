function normalizeIp(ip) {
  if (!ip) return "127.0.0.1";

  const trimmed = ip.trim();
  if (trimmed === "::1" || trimmed === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }

  return trimmed.replace(/^::ffff:/, "");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const firstIp = String(forwarded).split(",")[0];
    return normalizeIp(firstIp);
  }

  return normalizeIp(
    req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress
  );
}

module.exports = { getClientIp };
