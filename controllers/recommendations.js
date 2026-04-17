const pool = require("../db");

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Rule-based referral suggestions: proximity + equipment inventory.
 * Without keyword: hospitals & labs within radius (optionally boosted by name match to facilities).
 * With keyword: directory facilities that actually have matching equipment (avoids name mismatch with hospital/lab seeds).
 */
const getRecommendations = async (req, res) => {
  const lat = parseFloat(req.query.latitude);
  const lng = parseFloat(req.query.longitude);
  const radius = parseFloat(req.query.radius);
  const q = String(req.query.q || "").trim();

  const refLat = Number.isFinite(lat) ? lat : 40.7128;
  const refLng = Number.isFinite(lng) ? lng : -74.006;
  const maxRadius = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 500) : 50;

  try {
    const [hospitalsResult, labsResult, equipRows] = await Promise.all([
      pool.query(
        `SELECT id, name, location, facility_type, latitude, longitude
           FROM hospitals
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL`,
      ),
      pool.query(
        `SELECT id, name, location, facility_type, latitude, longitude
           FROM laboratories
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL`,
      ),
      pool.query(
        `SELECT f.id AS facility_id, f.name AS fname,
              COALESCE(SUM(CASE WHEN e.availability = true THEN 1 ELSE 0 END), 0)::int AS avail,
              COUNT(e.id)::int AS total
           FROM facilities f
           LEFT JOIN equipment e ON e.facility_id = f.id
           GROUP BY f.id, f.name`,
      ),
    ]);

    const nameToEquip = new Map();
    for (const row of equipRows.rows) {
      nameToEquip.set(normName(row.fname), {
        avail: row.avail,
        total: row.total,
      });
    }

    if (q) {
      const facilityMatch = await pool.query(
        `SELECT f.id, f.name, f.address AS location, f.facility_type,
            f.latitude, f.longitude,
            COALESCE(SUM(CASE WHEN e.availability = true THEN 1 ELSE 0 END), 0)::int AS avail,
            COUNT(e.id)::int AS total
         FROM facilities f
         INNER JOIN equipment e ON e.facility_id = f.id
         WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL
           AND strpos(lower(e.name), lower($1)) > 0
         GROUP BY f.id, f.name, f.address, f.facility_type, f.latitude, f.longitude`,
        [q],
      );

      const withDist = facilityMatch.rows.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        facility_type: r.facility_type,
        latitude: r.latitude,
        longitude: r.longitude,
        map_source: "facility",
        distanceMi: haversineMiles(
          refLat,
          refLng,
          parseFloat(r.latitude),
          parseFloat(r.longitude),
        ),
        keywordMatchAvail: r.avail,
        keywordMatchTotal: r.total,
        searchKeyword: q,
      }));

      withDist.sort((a, b) => a.distanceMi - b.distanceMi);
      return finishScoring(res, withDist, nameToEquip);
    }

    const places = [
      ...hospitalsResult.rows.map((r) => ({
        ...r,
        map_source: "hospital",
      })),
      ...labsResult.rows.map((r) => ({
        ...r,
        map_source: "laboratory",
      })),
    ];

    const withDist = places
      .map((p) => {
        const distanceMi = haversineMiles(
          refLat,
          refLng,
          parseFloat(p.latitude),
          parseFloat(p.longitude),
        );
        return { ...p, distanceMi };
      })
      .filter((p) => p.distanceMi <= maxRadius);

    return finishScoring(res, withDist, nameToEquip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function finishScoring(res, rows, nameToEquip) {
  const scored = rows
    .map((p) => {
      const equip = nameToEquip.get(normName(p.name)) || {
        avail: 0,
        total: 0,
      };
      const d = p.distanceMi;
      const distScore = Math.max(0, 100 - Math.min(d * 8, 75));
      const equipScore = Math.min(25 + equip.avail * 5, 50);
      const matchScore = Math.round(
        Math.min(99, distScore * 0.52 + equipScore * 0.48),
      );

      const keyword = p.searchKeyword;
      const reasonParts = keyword
        ? [
            `Matched equipment keyword “${keyword}” in the directory at this site.`,
            `About ${d.toFixed(1)} mi from the reference point.`,
            `${p.keywordMatchAvail ?? equip.avail} available row(s) for matching equipment; ${p.keywordMatchTotal ?? equip.total} total matching line item(s).`,
            p.facility_type === "laboratory"
              ? "Laboratory: confirm test availability and turnaround with the site."
              : "Hospital: confirm specialty services and capacity directly with the site.",
          ]
        : [
            `About ${d.toFixed(1)} mi from the reference point.`,
            equip.avail > 0
              ? `${equip.avail} available equipment record(s) linked under the same facility name in the equipment directory.`
              : "No equipment rows are linked under that exact facility name yet; proximity and site type still support shortlisting.",
            p.facility_type === "laboratory"
              ? "Laboratory: useful for diagnostic referrals and shared imaging or lab capacity."
              : "Hospital: confirm specialty services and bed capacity directly with the site.",
          ];

      return {
        id: `${p.map_source}-${p.id}`,
        hospital: p.name,
        facilityType: p.facility_type,
        distance: `${d.toFixed(1)} mi`,
        distanceMiles: d,
        equipmentAvailable: keyword ? p.keywordMatchAvail ?? equip.avail : equip.avail,
        equipmentTotal: keyword ? p.keywordMatchTotal ?? equip.total : equip.total,
        matchScore,
        reason: reasonParts.join(" "),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceMiles - b.distanceMiles)
    .slice(0, 12);

  res.json(scored);
}

module.exports = { getRecommendations };
