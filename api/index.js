let client = null;
const express = require("express"),
	pg = require("pg"),
	pool = new pg.Pool({
		connectionString: process.env.DATABASE_URL.replace(/'/g, ""),
		ssl: { rejectUnauthorized: false },
	}),
	port = process.env.PORT ?? 8000,
	getClient = async () => {
		if (client === null) client = await pool.connect();
		return client;
	},
	dataStartDate = new Date("2023-01-01"),
	dataEndDate = new Date("2023-12-31"),
	allowedFormats = new Set(["json", "csv"]),
	addColumns = (columns, content, prefix) => {
		prefix = prefix ?? "";
		if (typeof content !== "object")
			return columns.add(prefix === "" ? "value" : prefix);
		Object.entries(content).forEach((entry) => {
			const [key, value] = entry;
			if (
				value !== null &&
				typeof value === "object" &&
				!(value instanceof Date)
			)
				return addColumns(
					columns,
					value,
					prefix === "" ? key : `${prefix}.${key}`,
				);
			return columns.add(prefix === "" ? key : `${prefix}.${key}`);
		});
	},
	generateCSVHeader = (columns) => {
		return columns
			.map((column) =>
				/[\n,]/g.exec(column) !== null
					? `"${column.replaceAll(`"`, `\\"`)}"`
					: column,
			)
			.join(",");
	},
	generateCSVRow = (columns, item) => {
		const row = [];
		columns.forEach((column) => {
			let data = item;
			const components = column.split(".");
			components.forEach((component) => (data = data[component]));
			let dataString =
				data instanceof Date ? data.toISOString() : String(data ?? "");
			if (/[\n,]/g.exec(dataString) !== null)
				dataString = `"${dataString.replaceAll(`"`, `\\"`)}"`;
			row.push(dataString ?? "");
		});
		return row.join(",");
	},
	generateCSV = (content) => {
		const columns = new Set();
		if (Array.isArray(content)) {
			content.forEach((item) => addColumns(columns, item));
			const columnArray = Array.from(columns),
				header = generateCSVHeader(columnArray),
				csvContent = content.map((item) =>
					generateCSVRow(columnArray, item),
				);
			return [header, ...csvContent].join("\n");
		} else {
			addColumns(columns, content);
			const columnArray = Array.from(columns),
				header = generateCSVHeader(columnArray),
				csvContent = generateCSVRow(columnArray, content);
			return [header, csvContent].join("\n");
		}
	};

getClient();

express()
	.use((req, res, next) => {
		const format = req.query.format ?? "json";
		if (!allowedFormats.has(format)) {
			return res
				.status(400)
				.end(`400 Bad Request: Specified format is invalid.`);
		}
		switch (format) {
			case "csv":
				res.sendWithFormat = (content) => res.end(generateCSV(content));
				break;
			case "json":
			default:
				res.sendWithFormat = res.json;
				break;
		}
		next();
	})
	.use((req, res, next) => {
		if (req.method === "GET") return next();
		res.status(400).sendWithFormat({
			path: req.path,
			error_code: 400,
			error: "400 Bad Request",
			description: `Please use the GET method. Method given: ${req.method}`,
		});
	})
	.get("/", (req, res) => {
		res.sendWithFormat({
			path: "/",
			welcome_message: `Welcome to the TriMet Weather/Delay API!`,
			paths: {
				weather: "/weather",
				delay: "/delay",
				analysis: "/analysis",
			},
		});
	})
	.get("/weather", async (req, res) => {
		const documentation = {
				parameters: {
					date: "Date to find the weather (This or start_date is mandatory)",
					start_date:
						"Start date for a date range (This or date is mandatory)",
					end_date: "End date for a date range (optional)",
				},
				notes: "Valid dates are 2023-01-01 through 2023-12-31",
			},
			db = await getClient(),
			startDateString = req.query.start_date ?? req.query.date ?? null,
			endDateString = req.query.end_date ?? startDateString,
			startDate = new Date(startDateString),
			endDate = endDateString === null ? null : new Date(endDateString);

		if (
			startDateString === null ||
			isNaN(startDate) ||
			startDate < dataStartDate ||
			startDate > dataEndDate
		) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute date was not provided or was invalid.`,
				docs: documentation,
			});
		} else if (
			isNaN(endDate) ||
			(endDate != null && endDate < startDate) ||
			endDate > dataEndDate
		) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute end_date was not provided or was invalid.`,
				docs: documentation,
			});
		}
		return res.sendWithFormat(
			(
				await db.query(
					`SELECT * FROM toronto_weather WHERE date >= $1 AND date <= $2 ORDER BY DATE`,
					[startDate.toISOString(), endDate.toISOString()],
				)
			).rows,
		);
	})
	.get("/delay", async (req, res) => {
		const documentation = {
				parameters: {
					date: "Date to find the delay (This or start_date is mandatory)",
					start_date:
						"Start date for a date range (This or date is mandatory)",
					end_date: "End date for a date range (optional)",
					omit: "Omit columns (separated by ,)",
					aggregation: "Aggregation (all, hourly, daily, weekly)",
					aggregation_method:
						"Aggregation mode (min, max, mean [default], mode) (optional and will have no affect if Aggregation is all)",
				},
				notes: "Valid dates are 2023-01-01 through 2023-12-31",
			},
			db = await getClient(),
			startDateString = req.query.start_date ?? req.query.date ?? null,
			endDateString = req.query.end_date ?? startDateString,
			startDate = new Date(startDateString),
			endDate = endDateString === null ? null : new Date(endDateString);

		if (
			startDateString === null ||
			isNaN(startDate) ||
			startDate < dataStartDate ||
			startDate > dataEndDate
		) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute date was not provided or was invalid.`,
				docs: documentation,
			});
		} else if (
			isNaN(endDate) ||
			(endDate != null && endDate < startDate) ||
			endDate > dataEndDate
		) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute end_date was not provided or was invalid.`,
				docs: documentation,
			});
		}

		let cols =
				"line,delay_minutes,gap_minutes,direction,vehicle_id,location,reason,timestamp",
			aggregation = "all",
			aggregationMode = "mean",
			aggregationFunction = (column) => `AVG(${column}) mean_${column}`;
		const aggregableColumns = new Set(
				"delay_minutes,gap_minutes,timestamp".split(","),
			),
			aggregableColumnsMode = new Set(
				"line,delay_minutes,gap_minutes,direction,vehicle_id,location,reason,timestamp".split(
					",",
				),
			);

		switch (
			(req.query.aggregation ?? "").trim().toLowerCase().split("ly")[0]
		) {
			case "hour":
				aggregation = "hour";
				break;
			case "dai":
			case "day":
				aggregation = "day";
				break;
			case "week":
				aggregation = "week";
				break;
			case "month":
				aggregation = "month";
				break;
		}

		switch ((req.query.aggregation_method ?? "").trim().toLowerCase()) {
			case "min":
				aggregationMode = "min";
				aggregationFunction = (column) =>
					`MIN(${column}) min_${column}`;
				break;
			case "max":
				aggregationMode = "max";
				aggregationFunction = (column) =>
					`MAX(${column}) max_${column}`;
				break;
			case "mode":
				aggregationMode = "mode";
				aggregationFunction = (column) =>
					`MODE() WITHIN GROUP (ORDER BY ${column}) mode_${column}`;
				break;
		}

		cols = new Set(cols.split(","));
		(req.query.omit ?? "").split(",").map((omission) => {
			cols.delete(omission.toLowerCase());
		});
		if (aggregation !== "all") {
			// Replace non-aggregable columns
			cols = Array.from(cols);
			if (aggregationMode === "mode") {
				cols = cols.filter((col) => aggregableColumnsMode.has(col));
			} else {
				cols = cols.filter((col) => aggregableColumns.has(col));
			}
			cols = new Set(cols);

			if (cols.has("timestamp")) {
				cols.delete("timestamp");
				cols.add(`DATE_TRUNC('${aggregation}', timestamp) timestamp`);
			}

			cols = Array.from(cols)
				.map((column) => {
					if (column.startsWith("DATE_TRUNC")) return column;
					return aggregationFunction(column);
				})
				.join(",");
		} else {
			cols = Array.from(cols).join(",");
		}

		if (aggregation === "all")
			return res.sendWithFormat(
				(
					await db.query(
						`
					SELECT ${cols}
					FROM ttc_delay
					LEFT JOIN ttc_reason USING (reason_id)
					LEFT JOIN ttc_location USING (location_id)
					WHERE timestamp >= $1 AND timestamp <= $2
					ORDER BY timestamp
					`,
						[startDate.toISOString(), endDate.toISOString()],
					)
				).rows,
			);

		return res.sendWithFormat(
			(
				await db.query(
					`
				SELECT ${cols}
				FROM ttc_delay
				LEFT JOIN ttc_reason USING (reason_id)
				LEFT JOIN ttc_location USING (location_id)
				WHERE timestamp >= $1 AND timestamp <= $2
				GROUP BY DATE_TRUNC('${aggregation}', timestamp)
				ORDER BY DATE_TRUNC('${aggregation}', timestamp)
				`,
					[startDate.toISOString(), endDate.toISOString()],
				)
			).rows,
		);
	})
	.use((req, res, next) => {
		res.status(404).sendWithFormat({
			path: req.path,
			error_code: 404,
			error: "404 Not Found",
			description: `The path you requested does not exist.`,
		});
	})
	.listen(port);
