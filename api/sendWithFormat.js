const allowedFormats = new Set(["json", "csv"]),
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

module.exports = (req, res, next) => {
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
};
