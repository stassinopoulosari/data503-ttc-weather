const fs = require("fs"),
	inpath = "toronto-weather.json",
	outpath = "toronto-weather.csv",
	columns = [
		"date",
		"temperature.min",
		"temperature.max",
		"precipitation.total",
		"wind.max.speed",
	],
	inData = JSON.parse(fs.readFileSync(inpath, { encoding: "utf-8" }));

fs.writeFileSync(
	outpath,
	columns.map((column) => column.replaceAll(".", "_")).join(",") + "\n",
);
inData.forEach((weatherEntry) => {
	fs.appendFileSync(
		outpath,
		columns
			.map((key) => {
				let data = weatherEntry;
				key.split(".").forEach((component) => (data = data[component]));
				return data;
			})
			.join(",") + "\n",
	);
});
