module.exports = async (res, db, cols, dates, aggregation) => {
	try {
		if (aggregation ?? "all" !== "all")
			return res.sendWithFormat(
				(
					await db.query(
						`SELECT ${cols} FROM toronto_weather WHERE date >= $1 AND date <= $2
				GROUP BY DATE_TRUNC('${aggregation}', date)
			 	ORDER BY DATE_TRUNC('${aggregation}', date)`,
						[dates.start.toISOString(), dates.end.toISOString()],
					)
				).rows,
			);
		return res.sendWithFormat(
			(
				await db.query(
					`SELECT ${cols} FROM toronto_weather WHERE date >= $1 AND date <= $2 ORDER BY DATE`,
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
