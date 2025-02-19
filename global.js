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
        .domain(dailyCaloriePercentCarbs.map(d => d.day))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    yCalendar = d3.scaleLinear()
        .domain([0, d3.max(dailyCaloriePercentCarbs, d => d.total)])
        .range([height - margin.bottom, margin.top]);

    // Add X-axis (Days)
    svgCalendar.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xCalendar))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("transform", "rotate(-45)")
        .attr("font-size", "14px");

    // Add X-axis Label (Date)
    svgCalendar.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - margin.bottom + 90) // Position below axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Date");

    // Add Y-axis (Calories)
    svgCalendar.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yCalendar))
        .selectAll("text")
        .attr("font-size", "14px");

    // Add Y-axis Label (Calories)
    svgCalendar.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)") // Rotate for Y-axis
        .attr("x", -height / 2)
        .attr("y", margin.left - 60) // Position left of axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Calories");

    // 🔵 Main Calorie Intake (Stacked Above Sugar)
    svgCalendar.selectAll(".calorie-bar")
        .data(dailyCaloriePercentCarbs)
        .enter().append("rect")
        .attr("class", "calorie-bar")
        .attr("x", d => xCalendar(d.day))
        .attr("y", d => yCalendar(d.total))
        .attr("width", xCalendar.bandwidth())
        .attr("height", d => isNaN(d.total) ? 0 : height - margin.bottom - yCalendar(d.total))  // ✅ Prevent NaN
        .attr("fill", "rgba(50, 110, 160, 0.5)");  // Calories (Blue)

    // 🔴 Sugar Calories (Now at the Bottom)
    svgCalendar.selectAll(".carb-bar")
        .data(dailyCaloriePercentCarbs)
        .enter().append("rect")
        .attr("class", "carb-bar")
        .attr("x", d => xCalendar(d.day))
        .attr("y", d => yCalendar(d.carbCalories))  // Sugar now at the base
        .attr("width", xCalendar.bandwidth())
        .attr("height", d => height - margin.bottom - yCalendar(d.carbCalories))
        .attr("fill", "rgba(220, 20, 60, 0.6)");  // Crimson color for sugar

    // Transparent Interactive Overlay
    svgCalendar.selectAll(".bar-overlay")
        .data(dailyCaloriePercentCarbs)
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
                <strong>Date:</strong> ${d.day} <br>
                <strong>Total Calories:</strong> ${d.total} kcal<br>
                <strong>Carb Calories:</strong> ${d.carbCalories} kcal (${d.carbPercent.toFixed(1)}%)
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
        d.carbs = +d["total_carb"] || 0; 
        d.carbCalories = d.carbs * 4;  
        d.fiber = +d['dietary_fiber'] || 0;
        d.fiberCal = d.fiber * 4;
        d.protein = +d['protein'] || 0;
        d.proteinCal = d.protein * 4;
        d.total_fat = +d['total_fat'] || 0;
        d.total_fatCal = d.total_fat * 9;
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
    
    dailyCarbCalories = Array.from(
        d3.rollup(foodLogData, v => d3.sum(v, d => d.carbCalories), d => d.day),
        ([day, total]) => ({ day, total })
    );
    
    // ✅ Merge into one dataset with carb percentage
    dailyCaloriePercentCarbs = dailyCalories.map(d => {
        let carbEntry = dailyCarbCalories.find(c => c.day === d.day);
        let carbCalories = carbEntry ? carbEntry.total : 0;
        let carbPercent = (carbCalories / d.total) * 100;
        return { day: d.day, total: d.total, carbCalories, carbPercent };
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

    // Ensure enough margin for y-axis meal labels
    const updatedMargin = { ...margin, left: 160 };
    
    const xScatter = d3.scaleTime()
        .domain([new Date("2000-01-01 00:00"), new Date("2000-01-01 23:59")])
        .range([updatedMargin.left, width - updatedMargin.right]);

    const yFood = d3.scaleBand()
        .domain([...new Set(filteredFoodData.map(d => d.food))])
        .range([updatedMargin.top, height - updatedMargin.bottom])
        .padding(0.2);

    const rScale = d3.scaleSqrt()
        .domain([d3.min(filteredFoodData, d => d.calorie), d3.max(filteredFoodData, d => d.calorie)])
        .range([5, 20]);

    const svgScatter = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    // x axis
    svgScatter.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScatter).tickFormat(d3.timeFormat("%H:%M")));

    // Add X-axis Label
    svgScatter.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - updatedMargin.bottom + 40) // Position below axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Time");

    // y axis
    svgScatter.append("g")
        .attr("transform", `translate(${updatedMargin.left},0)`)
        .call(d3.axisLeft(yFood));
        
    // Add Y-axis Label 
    svgScatter.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)") // Rotate for Y-axis
        .attr("x", -height / 2)
        .attr("y", updatedMargin.left - 120) // Position left of axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Meals");

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
                <strong>Carb Calories:</strong> ${d.carbCalories.toFixed(1)} kcal<br>
                <strong>Sugar Calories:</strong> ${d.sugarCalories.toFixed(1)} g<br>
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

    // Append legend group
    const legend = svgScatter.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 180}, 40)`); // Adjust position

    // Add legend background box
    legend.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 100)  // Adjust width for proper spacing
    .attr("height", 30)  // Adjust height
    .attr("fill", "white")  // Background color
    .attr("stroke", "#333")  // Border color
    .attr("stroke-width", 1.5)
    .attr("rx", 5)  // Rounded corners
    .attr("ry", 5); 

    // Add legend circle
    legend.append("circle")
    .attr("cx", 15)
    .attr("cy", 15)
    .attr("r", 7)
    .attr("fill", "rgba(50, 110, 160, 0.5)");

    // Add legend text
    legend.append("text")
    .attr("x", 35)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("fill", "#333")
    .text("Calories");

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
    //  x axis
    svgGlucose.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xGlucose).tickFormat(d3.timeFormat("%H:%M")));

    // Add X-axis Label
    svgGlucose.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - margin.bottom + 45) // Position below axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Time");

    // y axis
    svgGlucose.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yGlucose));

    // Add Y-axis Label
    svgGlucose.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)") // Rotate for Y-axis
        .attr("x", -height / 2)
        .attr("y", margin.left - 45) // Position left of axis
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text("Glucose Level (mg/dL)");

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

    function brushMoved({ selection }) {
        if (!selection) {
            resetBrush();  // 🔴 Ensure brush is fully reset
            return;
        }
    
        const [x0, x1] = selection.map(xGlucose.invert);
    
        // Filter points within selection
        const selectedPoints = glucoseSubset.filter(d => {
            const time = new Date(`${d.day} ${d.time}`);
            return time >= x0 && time <= x1;
        });
    
        // Reset all points to red FIRST
        glucoseCircles.transition().duration(200).attr("fill", "red");
    
        if (selectedPoints.length > 0) {
            const avgGlucose = d3.mean(selectedPoints, d => d.level).toFixed(1);
            const timeWindowMinutes = Math.round((x1 - x0) / (1000 * 60)); // Convert ms to minutes
            const timeEnd = d3.timeFormat("%H:%M")(x1); // End time formatted
    
            showBrushStats(timeWindowMinutes, avgGlucose, x1);
        } else {
            d3.select(".brush-info").remove();
        }
    
        // Highlight only selected points
        glucoseCircles.transition()
            .duration(200)
            .attr("fill", d => {
                const time = new Date(`${d.day} ${d.time}`);
                return time >= x0 && time <= x1 ? "orange" : "red";
            });
    }
    
    function showBrushStats(timeWindow, avgGlucose, xEnd) {
        d3.select(".brush-info").remove(); // Remove previous text first
    
        svgGlucose.append("text")
            .attr("class", "brush-info")
            .attr("x", xGlucose(xEnd)) // Align text with the end of the brush
            .attr("y", margin.top - 30)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(`Time Window: ${timeWindow} mins | Avg Glucose: ${avgGlucose} mg/dL`);
    }
    
    //Reset Brush Function (Ensures Brush Info is Removed)
    function resetBrush() {
        brushGroup.call(brush.move, null);  // Clear brush selection
        d3.select(".brush-info").remove();  // Remove stats
        glucoseCircles.transition().duration(200).attr("fill", "red");  // Reset colors
    }
    

    // // 📌 Display Brushing Info (Now dynamically removed)
    d3.select(".legend-container").remove();  // 🔴 Remove previous legend

    // ✅ Add a properly formatted legend inside the graph
    const legend = svgGlucose.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 180}, 40)`); // Adjust position

    // Background box for legend
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 150)  // Adjust width
        .attr("height", 50)  // Adjust height
        .attr("fill", "white")  // Background color
        .attr("stroke", "#333")  // Border color
        .attr("stroke-width", 1.5)
        .attr("rx", 5)  // Rounded corners
        .attr("ry", 5); 

    // Red circle indicator for glucose
    legend.append("circle")
        .attr("cx", 15)
        .attr("cy", 20)
        .attr("r", 7)
        .attr("fill", "red");

    // Legend text for glucose
    legend.append("text")
        .attr("x", 30)
        .attr("y", 25)
        .attr("font-size", "14px")
        .attr("fill", "#333")
        .text("Glucose Level");

    // Blue dashed line indicator for meal time
    legend.append("line")
        .attr("x1", 10)
        .attr("x2", 40)
        .attr("y1", 40)
        .attr("y2", 40)
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

    // Legend text for meal time
    legend.append("text")
        .attr("x", 50)
        .attr("y", 44)
        .attr("font-size", "14px")
        .attr("fill", "#333")
        .text("Meal Time");

    createBackButton("Back to Meal", () => {
        d3.selectAll("svg, .back-button, .legend-container, .brush-info").remove();  // 🔴 Remove brush info too
        showMealScatterPlot(selectedDay);
    });

        // ✅ Ensure table remains properly positioned
        d3.select(".graph-container")
            .style("display", "flex")
            .style("justify-content", "space-between");
    }
    

function findNearestGlucose(mealTime, glucoseData) {
    return glucoseData.reduce((closest, current) => {
        return Math.abs(new Date(`2000-01-01 ${current.time}`) - new Date(`2000-01-01 ${mealTime}`)) <
               Math.abs(new Date(`2000-01-01 ${closest.time}`) - new Date(`2000-01-01 ${mealTime}`))
            ? current
            : closest;
    }, glucoseData[0])};
