// Load multiple CSVs and merge data by timestamp
Promise.all([
    d3.csv("data/dexcom_001cleaned.csv"),
    d3.csv("data/hr_001cleaned.csv"),
    d3.csv("data/food_log_001cleaned.csv")
]).then(([dexcomData, hrData, foodLogData]) => {
    // Convert string timestamps to Date objects and convert values to numbers
    dexcomData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.glucose = +d["Glucose Value (mg/dL)"];
    });

    hrData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.hr = +d["hr"];
    });

    foodLogData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.food = d["logged_food"];
        d.calorie = +d["calorie"];
        d.sugar = +d["sugar"];
    });

    // Merge the datasets on timestamp, matching the nearest time
    const mergedData = dexcomData.map(d => {
        const hrEntry = hrData.reduce((closest, hr) => 
            Math.abs(hr.timestamp - d.timestamp) < Math.abs(closest.timestamp - d.timestamp) ? hr : closest, 
            { timestamp: Infinity }
        );
        return {
            timestamp: d.timestamp,
            glucose: d.glucose,
            hr: hrEntry ? hrEntry.hr : null
        };
    });

    // Call the visualization function with the merged data
    createVisualization(mergedData, foodLogData);
});

function createVisualization(data, foodLogData) {
    const width = 1000;
    const height = 600;
    const marginTop = 20;
    const marginRight = 100;
    const marginBottom = 40;
    const marginLeft = 60;

    // Create time scale (X-axis)
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.timestamp))
        .range([marginLeft, width - marginRight]);

    // Create Y scale (shared for both glucose and heart rate)
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => Math.max(d.glucose, d.hr))])
        .range([height - marginBottom, marginTop]);

    // Create color scale
    const color = d3.scaleOrdinal()
        .domain(["glucose", "hr"])
        .range(["steelblue", "red"]);

    // Create SVG container
    const svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%");

    // Add X and Y axes
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y));

    // Add a group for the lines
    const linesGroup = svg.append("g");

    // Plot the glucose and heart rate lines inside the group
    ["glucose", "hr"].forEach(key => {
        const values = data.map(d => ({
            timestamp: d.timestamp,
            value: d[key] != null ? d[key] : null
        }));
        linesGroup.append("path")
            .datum(values)
            .attr("class", `line-${key}`)
            .attr("fill", "none")
            .attr("stroke", color(key))
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(d => x(d.timestamp))
                .y(d => y(d.value))
            );
    });

    // Add food markers
    svg.selectAll(".meal-marker")
        .data(foodLogData)
        .enter()
        .append("circle")
        .attr("class", "meal-marker")
        .attr("cx", d => x(d.timestamp))
        .attr("cy", marginTop)
        .attr("r", 5)
        .style("fill", "orange")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>Meal:</strong> ${d.food}<br>
                <strong>Calories:</strong> ${d.calorie}<br>
                <strong>Sugar:</strong> ${d.sugar || "N/A"} g
            `)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 30}px`);
        })
        .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

    // Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Add vertical rule for mouse interaction
    const rule = svg.append("line")
        .attr("y1", height - marginBottom)
        .attr("y2", marginTop)
        .attr("stroke", "black")
        .style("opacity", 0);

    svg.on("mousemove touchmove", function(event) {
        const [mouseX] = d3.pointer(event, this);
        const date = x.invert(mouseX);
        const closest = data.reduce((a, b) => 
            Math.abs(b.timestamp - date) < Math.abs(a.timestamp - date) ? b : a
        );

        // Update tooltip and rule
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`
            <strong>${d3.timeFormat("%Y-%m-%d %H:%M:%S")(closest.timestamp)}</strong><br>
            Glucose: ${closest.glucose || "N/A"}<br>
            Heart Rate: ${closest.hr || "N/A"}
        `)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 30}px`);

        rule.attr("transform", `translate(${x(closest.timestamp)},0)`).style("opacity", 1);
    }).on("mouseout", () => {
        tooltip.transition().duration(200).style("opacity", 0);
        rule.style("opacity", 0);
    });

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => {
            const newX = event.transform.rescaleX(x);

            // Update the X-axis with the new scale
            svg.select("g").call(d3.axisBottom(newX));

            // Update the lines with the new X scale
            linesGroup.selectAll("path")
                .attr("d", d3.line()
                    .x(d => newX(d.timestamp))
                    .y(d => y(d.value)));

            // Update the food markers to match the zoom
            svg.selectAll(".meal-marker")
                .attr("cx", d => newX(d.timestamp));
        });

    // Apply zoom behavior to the SVG
    svg.call(zoom);
}
