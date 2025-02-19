// Global dimensions
const width = 1000;
const height = 600;
const margin = { top: 50, right: 100, bottom: 120, left: 100 };

let xCalendar, yCalendar, dailyCalories, foodLogData;

// Tooltip for displaying details on hover
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ddd")
    .style("padding", "8px")
    .style("font-size", "14px")
    .style("border-radius", "5px")
    .style("pointer-events", "none")
    .style("box-shadow", "2px 2px 5px rgba(0, 0, 0, 0.2)");

function renderCalendar() {
    d3.selectAll("svg, .back-button").remove();

    const svgCalendar = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    xCalendar = d3.scaleBand()
        .domain(dailyCaloriePercentSugar.map(d => d.day))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    yCalendar = d3.scaleLinear()
        .domain([0, d3.max(dailyCaloriePercentSugar, d => d.total)])
        .range([height - margin.bottom, margin.top]);

    // Add X-axis (Days)
    svgCalendar.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xCalendar))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("transform", "rotate(-45)")
        .attr("font-size", "14px");

    // Add Y-axis (Calories)
    svgCalendar.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yCalendar))
        .selectAll("text")
        .attr("font-size", "14px");

    // 🔴 Sugar Calories (Now at the Bottom)
    svgCalendar.selectAll(".sugar-bar")
        .data(dailyCaloriePercentSugar)
        .enter().append("rect")
        .attr("class", "sugar-bar")
        .attr("x", d => xCalendar(d.day))
        .attr("y", d => yCalendar(d.sugarCalories))  // Sugar now at the base
        .attr("width", xCalendar.bandwidth())
        .attr("height", d => height - margin.bottom - yCalendar(d.sugarCalories))
        .attr("fill", "rgba(220, 20, 60, 0.5)");  // Crimson color for sugar

    // 🔵 Main Calorie Intake (Stacked Above Sugar)
    svgCalendar.selectAll(".calorie-bar")
        .data(dailyCaloriePercentSugar)
        .enter().append("rect")
        .attr("class", "calorie-bar")
        .attr("x", d => xCalendar(d.day))
        .attr("y", d => yCalendar(d.total))
        .attr("width", xCalendar.bandwidth())
        .attr("height", d => height - margin.bottom - yCalendar(d.total - d.sugarCalories))
        .attr("fill", "rgba(50, 110, 160, 0.5)");  // Calories (Blue)

    // Transparent Interactive Overlay
    svgCalendar.selectAll(".bar-overlay")
        .data(dailyCaloriePercentSugar)
        .enter().append("rect")
        .attr("class", "bar-overlay")
        .attr("x", d => xCalendar(d.day))
        .attr("y", d => yCalendar(d.total))
        .attr("width", xCalendar.bandwidth())
        .attr("height", d => height - margin.bottom - yCalendar(d.total))
        .attr("fill", "transparent")  // Invisible overlay
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).style("fill", "rgba(0, 0, 0, 0.1)");  // Subtle hover effect

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>Day:</strong> ${d.day} <br>
                <strong>Total Calories:</strong> ${d.total} kcal<br>
                <strong>Sugar Calories:</strong> ${d.sugarCalories} kcal (${d.sugarPercent.toFixed(1)}%)
            `)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 30}px`);
        })
        .on("mouseout", function() {
            d3.select(this).style("fill", "transparent");  // Reset
            tooltip.transition().duration(200).style("opacity", 0);
        })
        .on("click", (event, d) => showMealScatterPlot(d.day));

}


Promise.all([
    d3.csv("data/food_log_001cleaned.csv"),
    d3.csv("data/dexcom_001cleaned.csv"),  // Load glucose data
    d3.csv("data/hr_001cleaned.csv")  // Load heart rate data
]).then(([loadedFoodData, loadedGlucoseData, loadedHRData]) => {
    foodLogData = loadedFoodData;

    foodLogData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.day = d3.timeFormat("%Y-%m-%d")(d.timestamp);
        d.time = d3.timeFormat("%H:%M")(d.timestamp);
        d.food = d["logged_food"];
        d.calorie = +d["calorie"];
        d.sugar = +d["sugar"] || 0;
        d.sugarCalories = d.sugar * 4;
        d.total_carb = +d["total_carb"] || 0; // ✅ Store total carbs
    });

    // 📈 Process Glucose Data (Dexcom)
    glucoseData = loadedGlucoseData;
    console.log("✅ Loaded Glucose Data:", glucoseData);
    glucoseData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.day = d3.timeFormat("%Y-%m-%d")(d.timestamp);
        d.time = d3.timeFormat("%H:%M")(d.timestamp);
        d.level = +d["Glucose Value (mg/dL)"]; // Assuming column name is "glucose_level"
    });

    // ❤️ Process Heart Rate Data (HR)
    heartRateData = loadedHRData;
    heartRateData.forEach(d => {
        d.timestamp = new Date(d["datetime"]);
        d.day = d3.timeFormat("%Y-%m-%d")(d.timestamp);
        d.time = d3.timeFormat("%H:%M")(d.timestamp);
        d.heartRate = +d["hr"]; // Assuming column name is "heart_rate"
    });

    // Compute daily total calories & sugar calories
    dailyCalories = Array.from(
        d3.rollup(foodLogData, v => d3.sum(v, d => d.calorie), d => d.day),
        ([day, total]) => ({ day, total })
    );

    dailySugarCalories = Array.from(
        d3.rollup(foodLogData, v => d3.sum(v, d => d.sugarCalories), d => d.day),
        ([day, total]) => ({ day, total })
    );

    // Merge into one dataset with sugar percentage
    dailyCaloriePercentSugar = dailyCalories.map(d => {
        let sugarEntry = dailySugarCalories.find(s => s.day === d.day);
        let sugarCalories = sugarEntry ? sugarEntry.total : 0;
        let sugarPercent = (sugarCalories / d.total) * 100;
        return { day: d.day, total: d.total, sugarCalories, sugarPercent };
    });

    renderCalendar(); // Now pass the processed data
});

let currentView = "calendar";  // Tracks where user is (calendar, meal, glucose)

function createBackButton(text, callback) {
    d3.select(".back-button").remove();  // Remove any existing button

    d3.select("body").append("button")
        .attr("class", "back-button")
        .text(text)
        .style("position", "fixed")
        .style("bottom", "20px")
        .style("left", "20px")
        .style("padding", "10px 15px")
        .style("background", "#346789")
        .style("color", "white")
        .style("border", "none")
        .style("border-radius", "5px")
        .style("cursor", "pointer")
        .on("mouseover", function() { d3.select(this).style("background", "#265578"); })
        .on("mouseout", function() { d3.select(this).style("background", "#346789"); })
        .on("click", callback);
}

// 📌 Show Meal Scatterplot (Updates Back Button to "Back to Calendar")
function showMealScatterPlot(selectedDay) {
    currentView = "meal";  // Update view state
    d3.select(".tooltip").style("opacity", 0);
    d3.selectAll("svg, .back-button").remove();

    createBackButton("Back to Calendar", () => {
        d3.selectAll("svg, .back-button").remove();
        renderCalendar();
    });

    const filteredFoodData = foodLogData.filter(d => d.day === selectedDay);

    const xScatter = d3.scaleTime()
        .domain([new Date("2000-01-01 00:00"), new Date("2000-01-01 23:59")])
        .range([margin.left, width - margin.right]);

    const yFood = d3.scaleBand()
        .domain([...new Set(filteredFoodData.map(d => d.food))])
        .range([height - margin.bottom, margin.top])
        .padding(0.2);

    const rScale = d3.scaleSqrt()
        .domain([d3.min(filteredFoodData, d => d.calorie), d3.max(filteredFoodData, d => d.calorie)])
        .range([5, 20]);

    const svgScatter = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    svgScatter.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScatter).tickFormat(d3.timeFormat("%H:%M")));

    svgScatter.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yFood));

    svgScatter.selectAll(".meal-circle")
        .data(filteredFoodData)
        .enter().append("circle")
        .attr("class", "meal-circle")
        .attr("cx", d => xScatter(new Date(`2000-01-01 ${d.time}`)))
        .attr("cy", d => yFood(d.food) + yFood.bandwidth() / 2)
        .attr("r", d => rScale(d.calorie))
        .attr("fill", "rgba(50, 110, 160, 0.5)")
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", rScale(d.calorie) + 5)
                .attr("fill", "rgba(50, 110, 160, 1)");
        
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>Meal:</strong> ${d.food}<br>
                <strong>Calories:</strong> ${d.calorie} kcal<br>
                <strong>Carbs:</strong> ${d.total_carb.toFixed(1)}g<br>
                <strong>Sugar:</strong> ${d.sugar.toFixed(1)}g<br>
                <strong>Time:</strong> ${d.time}
            `)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 30}px`);
        })        
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", rScale(d.calorie))
                .attr("fill", "rgba(50, 110, 160, 0.5)");

            tooltip.transition().duration(200).style("opacity", 0);
        })
        .on("click", function(event, d) {
            showFocusedGlucoseGraph(d.day, d.time, d.food); // ⬅️ SWITCH TO GLUCOSE GRAPH
        });
}

// 📌 Show Focused Glucose Graph (with Brushing)
function showFocusedGlucoseGraph(selectedDay, mealTime, mealName) {
    d3.select(".tooltip").style("opacity", 0);
    d3.selectAll("svg, .back-button, .legend-container, .brush-info").remove();  // 🔴 Remove previous elements

    // Convert meal time to Date object
    const mealTimestamp = new Date(`${selectedDay} ${mealTime}`);
    const oneHourBefore = new Date(mealTimestamp.getTime() - 60 * 60 * 1000);
    const oneHourAfter = new Date(mealTimestamp.getTime() + 60 * 60 * 1000);

    const glucoseSubset = glucoseData.filter(d => {
        const glucoseTimestamp = new Date(`${d.day} ${d.time}`);
        return d.day === selectedDay && glucoseTimestamp >= oneHourBefore && glucoseTimestamp <= oneHourAfter;
    });

    if (glucoseSubset.length === 0) {
        alert("No glucose data available for this meal time.");
        return;
    }

    const xGlucose = d3.scaleTime()
        .domain([oneHourBefore, oneHourAfter])
        .range([margin.left, width - margin.right]);

    const yGlucose = d3.scaleLinear()
        .domain([d3.min(glucoseSubset, d => d.level) - 5, d3.max(glucoseSubset, d => d.level) + 5])
        .range([height - margin.bottom, margin.top]);

    const svgGlucose = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    // Add axes
    svgGlucose.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xGlucose).tickFormat(d3.timeFormat("%H:%M")));

    svgGlucose.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yGlucose));

    // Draw glucose line
    const glucoseLine = d3.line()
        .x(d => xGlucose(new Date(`${d.day} ${d.time}`)))
        .y(d => yGlucose(d.level))
        .curve(d3.curveMonotoneX);

    svgGlucose.append("path")
        .datum(glucoseSubset)
        .attr("fill", "none")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("d", glucoseLine);

    // Add glucose points
    const glucoseCircles = svgGlucose.selectAll(".glucose-circle")
        .data(glucoseSubset)
        .enter().append("circle")
        .attr("class", "glucose-circle")
        .attr("cx", d => xGlucose(new Date(`${d.day} ${d.time}`)))
        .attr("cy", d => yGlucose(d.level))
        .attr("r", 5)
        .attr("fill", "red")
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(200).attr("r", 8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>Time:</strong> ${d.time}<br><strong>Glucose:</strong> ${d.level} mg/dL`)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 30}px`);
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("r", 5);
            tooltip.transition().duration(200).style("opacity", 0);
        });

    // 🔵 Add meal time marker (dashed line)
    // 🔵 Meal Time Marker (Dashed Line)
    const mealLine = svgGlucose.append("line")
        .attr("x1", xGlucose(mealTimestamp))
        .attr("x2", xGlucose(mealTimestamp))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

    // ✅ Make an invisible overlay for easy hover interaction
    svgGlucose.append("rect")
        .attr("x", xGlucose(mealTimestamp) - 5) // Expand hitbox slightly
        .attr("y", margin.top)
        .attr("width", 10)  // Small area for easier interaction
        .attr("height", height - margin.bottom - margin.top)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("mouseover", function(event) {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>${mealName}</strong> was eaten`)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 30}px`);
        })
        .on("mouseout", function() {
            tooltip.transition().duration(200).style("opacity", 0);
        });




    // ✅ Brushing for interactive selection
    const brush = d3.brushX()
        .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .on("brush end", brushMoved);

    // Append brushing group
    const brushGroup = svgGlucose.append("g")
        .attr("class", "brush")
        .call(brush);

    // 📌 Brushing Event Handler
    function brushMoved({ selection }) {
        if (!selection) {
            resetBrush();  // Call reset function when selection is cleared
            return;
        }
    
        const [x0, x1] = selection.map(xGlucose.invert);
    
        // Filter points within selection
        const selectedPoints = glucoseSubset.filter(d => {
            const time = new Date(`${d.day} ${d.time}`);
            return time >= x0 && time <= x1;
        });
    
        // 🔥 **Explicitly reset all points to red FIRST (fix for first brush interaction)**
        glucoseCircles.transition().duration(200).attr("fill", "red");
    
        // Show brush stats
        if (selectedPoints.length > 0) {
            const avgGlucose = d3.mean(selectedPoints, d => d.level).toFixed(1);
            showBrushStats(selectedPoints.length, avgGlucose, x1);
        }
    
        // Highlight selected points
        glucoseCircles.transition()
            .duration(200)
            .attr("fill", d => {
                const time = new Date(`${d.day} ${d.time}`);
                return time >= x0 && time <= x1 ? "orange" : "red";
            });
    }
    

    // 📌 Reset Brush Function (Ensures Brush Info is Removed)
    function resetBrush() {
        brushGroup.call(brush.move, null);  // Clear brush selection
        d3.select(".brush-info").remove();  // 🔥 Ensure stats disappear
        glucoseCircles.transition().duration(200).attr("fill", "red");  // Reset colors
    }

    // 📌 Display Brushing Info (Now dynamically removed)
    function showBrushStats(count, avgGlucose, xPos) {
        d3.select(".brush-info").remove(); // 🔥 Remove previous text first

        svgGlucose.append("text")
            .attr("class", "brush-info")
            .attr("x", xGlucose(xPos))
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(`Points: ${count} | Avg Glucose: ${avgGlucose} mg/dL`);
    }


    // ✅ **Legend: Meal Name**
    d3.select(".legend-container").remove();  // 🔴 Remove previous legend

    const legend = d3.select("body").append("div")
        .attr("class", "legend-container");

    legend.append("div")
        .attr("class", "legend-box");

    legend.append("span")
        .text(`${mealName ? mealName : "A meal"} was ingested`);

    createBackButton("Back to Meal", () => {
        d3.selectAll("svg, .back-button, .legend-container, .brush-info").remove();  // 🔴 Remove brush info too
        showMealScatterPlot(selectedDay);
    });
}

function findNearestGlucose(mealTime, glucoseData) {
    return glucoseData.reduce((closest, current) => {
        return Math.abs(new Date(`2000-01-01 ${current.time}`) - new Date(`2000-01-01 ${mealTime}`)) <
               Math.abs(new Date(`2000-01-01 ${closest.time}`) - new Date(`2000-01-01 ${mealTime}`))
            ? current
            : closest;
    }, glucoseData[0]);
}