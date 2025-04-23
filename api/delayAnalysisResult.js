module.exports = async (
	res,
	db,
	cols,
	mode,
	groupBy,
	orderBy,
	dates,
	aggregation,
) => {
	try {
		aggregation = aggregation ?? "all";
		if (aggregation !== "all" || groupBy)
			return res.sendWithFormat(
				(
					await db.query(
						`
				SELECT ${cols}
				FROM ttc_delay
				JOIN ttc_reason USING (reason_id)
				JOIN ttc_location USING (location_id)
				${mode === "analysis" ? ` JOIN toronto_weather ON date = DATE_TRUNC('day', timestamp)::DATE` : ""}
				WHERE timestamp >= $1 AND timestamp <= $2
				${aggregation !== "all" ? `GROUP BY DATE_TRUNC('${aggregation}', timestamp)` : "GROUP BY "}
				${groupBy ? `${aggregation === "all" ? "" : ","}${groupBy}` : ""}
				${orderBy ? `ORDER BY ${orderBy.replace("-", "")} ${orderBy.startsWith("-") ? "DESC" : ""}` : aggregation !== "all" ? `ORDER BY DATE_TRUNC('${aggregation}', timestamp)` : `ORDER BY ${groupBy ? groupBy : "timestamp"}`}
				`,
						[dates.start.toISOString(), dates.end.toISOString()],
					)
				).rows,
			);
		return res.sendWithFormat(
			(
				await db.query(
					`
			SELECT ${cols}${groupBy ? `,${groupBy}` : ""}
			FROM ttc_delay
			JOIN ttc_reason USING (reason_id)
			JOIN ttc_location USING (location_id)
			${mode === "analysis" ? ` JOIN toronto_weather ON date = DATE_TRUNC('day', timestamp)::DATE` : ""}
			WHERE timestamp >= $1 AND timestamp <= $2
			${orderBy ? `ORDER BY ${orderBy.replace("-", "")} ${orderBy.startsWith("-") ? "DESC" : ""}` : `ORDER BY timestamp`}
			`,
					[dates.start.toISOString(), dates.end.toISOString()],
				)
			).rows,
		);
	} catch (err) {
		console.error(err);
		return res.status(500).sendWithFormat({
			error: {
				type: "Database error",
				representation: err.toString(),
			},
		});
	}
};
