const validAggregations = {
		all: "all",
		hour: "hour",
		day: "day",
		dai: "day",
		week: "week",
		month: "month",
	},
	aggregationMethods = {
		avg: (column) => `AVG(${column}) mean_${column}`,
		mean: (column) => `AVG(${column}) mean_${column}`,
		min: (column) => `MIN(${column}) min_${column}`,
		max: (column) => `MAX(${column}) max_${column}`,
		mode: (column) =>
			`MODE() WITHIN GROUP (ORDER BY ${column}) mode_${column}`,
	};

module.exports = {
	dates: (req, res, next) => {
		/* Get start and end dates */
		const startDateString = req.query.start_date ?? req.query.date ?? null,
			endDateString = req.query.end_date ?? startDateString,
			startDate =
				startDateString === null ? null : new Date(startDateString),
			endDate = endDateString === null ? null : new Date(endDateString);
		req.dates = {
			start: isNaN(startDate) ? null : startDate,
			end: isNaN(endDate) ? null : endDate,
		};
		next();
	},
	aggregation: (req, res, next) => {
		/* Get aggregation and methods */
		const aggregationParam = (req.query.aggregate_over ?? "")
				.trim()
				.toLowerCase(),
			aggregationMethodParam = (req.query.aggregate_by ?? "")
				.trim()
				.toLowerCase();
		req.aggregation = {
			over: validAggregations[aggregationParam] ?? "all",
			function:
				aggregationMethods[aggregationMethodParam] ??
				aggregationMethods["mean"],
		};
		req.aggregation.method =
			aggregationMethods[aggregationMethodParam] === undefined
				? "mean"
				: aggregationMethodParam;
		next();
	},
};
