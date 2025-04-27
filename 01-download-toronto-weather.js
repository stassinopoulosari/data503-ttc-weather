const axios = require("axios"),
	date = new Date("2023-01-01"),
	endDate = new Date("2024-01-01"),
	appID = process.env.OPENWEATHER_KEY;

(async () => {
	console.log("[");

	while (date < endDate) {
		// Get Toronto weather for this date
		const dateString = date.toISOString().split("T")[0],
			uri =
				`https://api.openweathermap.org/data/3.0/onecall/day_summary` +
				`?lat=43.697732` +
				`&lon=-79.396969` +
				`&date=${dateString}` +
				`&units=metric&appid=${appID}`,
			response = await axios({
				method: "get",
				url: uri,
				responseType: "json",
			});
		console.log(JSON.stringify(response.data), ",");
		date.setDate(date.getDate() + 1);
	}
	console.log("]");
})();
