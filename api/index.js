let client = null;
const express = require("express"),
	sendWithFormat = require("./sendWithFormat.js"),
	preprocessors = require("./preprocessors.js"),
	sendWeatherResult = require("./weatherResult.js"),
	sendDelayAnalysisResult = require("./delayAnalysisResult.js"),
	pg = require("pg"),
	pool = new pg.Pool({
		connectionString: process.env.DATABASE_URL.replace(/'/g, ""),
		ssl: { rejectUnauthorized: false },
	}),
	port = process.env.PORT ?? 8000,
	getClient = async () => {
		if (client === null) client = await pool.connect();
		return client;
	};

getClient();

express()
	.use(sendWithFormat)
	.use(preprocessors.dates)
	.use(preprocessors.aggregation)
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
			welcome_message: `Welcome to the TTC Weather/Delay API!`,
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
					aggregate_over:
						"Aggregation (all [default], weekly, monthly)",
					aggregate_by:
						"Aggregation mode (mean [default], min, max, mode) (optional and will have no affect if aggregation is set to all)",
				},
				paths: {
					home: "/",
					weather: "/weather",
					analysis: "/analysis",
				},
			},
			db = await getClient(),
			dates = req.dates,
			aggregation = req.aggregation.over,
			aggregationFunction = req.aggregation.function;
		if (dates.start === null) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute date was not provided or was invalid.`,
				docs: documentation,
			});
		} else if (dates.end === null) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute end_date was invalid.`,
				docs: documentation,
			});
		} else if (aggregation === "hour" || aggregation === "day") {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `The only valid aggregations for weather are all, weekly, and monthly.`,
				docs: documentation,
			});
		}

		let cols =
			"date,temperature_min,temperature_max,precipitation_total,wind_max_speed";

		if (aggregation !== "all") {
			const colsArray = cols.split(",");
			cols = [
				...colsArray.map((column) => {
					if (column === "date")
						return `DATE_TRUNC('${aggregation}', date) date`;
					return aggregationFunction(column);
				}),
				`COUNT(*)`,
			].join(",");
			return sendWeatherResult(res, db, cols, dates, aggregation);
		} else {
			return sendWeatherResult(res, db, cols, dates);
		}
	})
	.get(["/delay", "/analysis"], async (req, res) => {
		const mode = req.path.replaceAll("/", ""),
			documentation = {
				parameters: {
					date: `Date to find the ${mode === "delay" ? "delay" : "delay/weather combination"} (This or start_date is mandatory)`,
					start_date:
						"Start date for a date range (This or date is mandatory)",
					end_date: "End date for a date range (optional)",
					aggregate_over:
						"Aggregation (all, hourly, daily, weekly, monthly)",
					aggregate_by:
						"Aggregation mode (min, max, mean [default], mode) (optional and will have no affect if Aggregation is all)",
					group_by:
						"Group by another column (options are none, line, direction, vehicle_id, location, reason)",
					order_by:
						"Order by one of the columns present in the output (optional)",
				},
				notes: "Valid dates are 2023-01-01 through 2023-12-31",
				paths: {
					home: "/",
					weather: "/weather",
				},
			},
			db = await getClient(),
			validGroupby = new Set(
				"line direction vehicle_id location reason".split(" "),
			),
			dates = req.dates;

		documentation[mode === "delay" ? "analysis" : "delay"] =
			mode === "delay" ? "/analysis" : "/delay";

		let groupBy = (req.query.group_by ?? "").toLowerCase().trim();
		if (!validGroupby.has(groupBy)) {
			if (groupBy !== "") {
				return res.status(400).sendWithFormat({
					path: req.path,
					error_code: 400,
					error: "400 Bad Request",
					description: `Attribute group_by was not a valid group by.`,
					docs: documentation,
				});
			}
			groupBy = null;
		}

		if (dates.start === null) {
			return res.status(400).sendWithFormat({
				path: req.path,
				error_code: 400,
				error: "400 Bad Request",
				description: `Attribute date was not provided or was invalid.`,
				docs: documentation,
			});
		} else if (dates.end === null || dates.end <= dates.start) {
			dates.end = new Date(dates.start);
			dates.end.setDate(dates.end.getDate() + 1);
		}

		let cols = `line,delay_minutes,gap_minutes,direction,vehicle_id,location,reason${mode === "analysis" ? ",temperature_min,temperature_max,precipitation_total,wind_max_speed" : ""},timestamp`;
		const aggregation = req.aggregation.over,
			aggregationMethod = req.aggregation.method,
			aggregationFunction = req.aggregation.function,
			aggregableColumns = new Set(
				`delay_minutes,gap_minutes${mode === "analysis" ? ",temperature_min,temperature_max,precipitation_total,wind_max_speed" : ""},timestamp`.split(
					",",
				),
			),
			aggregableColumnsMode = new Set(
				`line,delay_minutes,gap_minutes,direction,vehicle_id,location,reason${mode === "analysis" ? ",temperature_min,temperature_max,precipitation_total,wind_max_speed" : ""},timestamp`.split(
					",",
				),
			);

		if (aggregation !== "all" || groupBy) {
			// Replace non-aggregable columns
			let colsArray = cols.split(",");
			if (aggregation === "all") {
				aggregableColumns.delete("timestamp");
				aggregableColumnsMode.delete("timestamp");
			}
			if (aggregationMethod === "mode") {
				colsArray = colsArray.filter((col) =>
					aggregableColumnsMode.has(col),
				);
			} else {
				colsArray = colsArray.filter((col) =>
					aggregableColumns.has(col),
				);
			}
			colsArray = [
				...(groupBy ? [groupBy] : []),
				...colsArray.map((column) => {
					if (column === "timestamp")
						return `DATE_TRUNC('${aggregation}', timestamp) timestamp`;
					return aggregationFunction(column);
				}),
				`COUNT(*) count`,
			];
			let orderBy = (req.query.order_by ?? "").trim().toLowerCase();
			if (
				!colsArray
					.map((col) => /[a-z_]+$/.exec(col)[0])
					.includes(orderBy.replace("-", ""))
			)
				orderBy = null;
			cols = colsArray.join(",");
			return sendDelayAnalysisResult(
				res,
				db,
				cols,
				mode,
				groupBy,
				orderBy,
				dates,
				aggregation,
			);
		}

		let orderBy = (req.query.order_by ?? "").trim().toLowerCase();
		if (!cols.split(",").includes(orderBy.replace("-", ""))) orderBy = null;
		return sendDelayAnalysisResult(
			res,
			db,
			cols,
			mode,
			groupBy,
			orderBy,
			dates,
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
