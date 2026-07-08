// API Endpoints as defined in the project and PDF requirements
const studentsEndpoint = "https://apidemo.geoeducacion.com.ar/api/testing/estudiantes/1";
const assistancesByCourseEndpoint = "https://apidemo.geoeducacion.com.ar/api/testing/asistencia/1";
const assistancesByMonthEndpoint = "https://apidemo.geoeducacion.com.ar/api/testing/historial_asistencia/1";
const gradingsByCourseEndpoint = "https://apidemo.geoeducacion.com.ar/api/testing/calificaciones/1";
const communicationsEndpoint = "https://apidemo.geoeducacion.com.ar/api/testing/comunicados/1";

// Cache for storing loaded data to prevent redundant API requests
let state = {
    students: [],
    attendance: [],
    monthlyAttendance: [],
    grades: [],
    comms: {},
    selectedLevel: 'All'
};

// Object to keep track of active Chart.js instances for dynamic destruction and re-creation
const charts = {};

// Palette Colors corresponding to CSS Custom Properties (Light Theme)
const COLORS = {
    primary: 'rgba(79, 70, 229, 0.85)',        // Indigo
    primarySolid: '#4f46e5',
    secondary: 'rgba(147, 51, 234, 0.85)',     // Purple
    secondarySolid: '#9333ea',
    success: 'rgba(16, 185, 129, 0.85)',       // Emerald
    successSolid: '#10b981',
    danger: 'rgba(244, 63, 94, 0.85)',         // Rose/Danger
    dangerSolid: '#f43f5e',
    warning: 'rgba(245, 158, 11, 0.85)',       // Amber
    warningSolid: '#f59e0b',
    info: 'rgba(6, 182, 212, 0.85)',           // Cyan
    infoSolid: '#06b6d4',
    muted: '#475569',                          // Slate grey for axes text labels
    gridLines: '#e2e8f0'                       // Light grey for grid lines
};

// Apply Chart.js global defaults for light theme aesthetics
if (window.Chart) {
    Chart.defaults.color = COLORS.muted;
    Chart.defaults.borderColor = COLORS.gridLines;
    Chart.defaults.font.family = "'Outfit', -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.color = COLORS.muted;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#f3f4f6';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
}

// Fetch helper with standard GET request structure
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
        throw new Error(json.messages || "Error retrieving data from API");
    }
    return json.data;
}

// Render or update individual charts safely by destroying old instances
function renderChart(chartId, config) {
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    const canvas = document.getElementById(chartId);
    if (canvas) {
        charts[chartId] = new Chart(canvas, config);
    }
}

// Initialize loading overlays
function toggleLoaders(show) {
    const overlays = document.querySelectorAll('.loading-overlay');
    overlays.forEach(overlay => {
        overlay.style.opacity = show ? '1' : '0';
        overlay.style.pointerEvents = show ? 'all' : 'none';
    });
}

// Main initialization function
document.addEventListener("DOMContentLoaded", async () => {
    toggleLoaders(true);
    try {
        // Fetch all endpoints simultaneously
        const [students, attendance, monthlyAttendance, grades, comms] = await Promise.all([
            fetchData(studentsEndpoint),
            fetchData(assistancesByCourseEndpoint),
            fetchData(assistancesByMonthEndpoint),
            fetchData(gradingsByCourseEndpoint),
            fetchData(communicationsEndpoint)
        ]);

        // Save raw data to application state
        state.students = students;
        state.attendance = attendance;
        state.monthlyAttendance = monthlyAttendance;
        state.grades = grades;
        state.comms = Array.isArray(comms) ? comms[0] : comms;

        // Hide loaders and build initial dashboard
        toggleLoaders(false);
        updateDashboard();

        // Level Filter select element event handler
        const filterSelect = document.getElementById('level-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                state.selectedLevel = e.target.value;
                updateDashboard();
            });
        }

    } catch (error) {
        console.error("Dashboard initialization error:", error);
        toggleLoaders(false);
        // Display fallback error messages on card bodies
        const containers = document.querySelectorAll('.chart-body');
        containers.forEach(container => {
            container.innerHTML = `<div class="error-message">⚠️ Error al cargar los datos de la API: ${error.message}</div>`;
        });
    }
});

// Main dashboard orchestration function (triggered on load and on filter changes)
function updateDashboard() {
    const level = state.selectedLevel;

    // 1. FILTER DATA BY SELECTED LEVEL
    const filteredStudents = level === 'All' 
        ? state.students 
        : state.students.filter(s => s.nivel === level);

    const filteredAttendance = level === 'All' 
        ? state.attendance 
        : state.attendance.filter(a => a.nivel === level);

    const filteredGrades = level === 'All' 
        ? state.grades 
        : state.grades.filter(g => g.nivel === level);

    // 2. COMPUTE AND UPDATE KPI SUMMARY CARDS
    updateKPICards(filteredStudents, filteredAttendance, filteredGrades);

    // 3. RENDER ALL THE 7 CHARTS WITH THEIR SPECIFIC CHART TYPES
    renderChart1Composition(filteredStudents);
    renderChart2AttendanceGeneral(filteredAttendance);
    renderChart3AttendanceCourse(filteredAttendance);
    renderChart4AttendanceMonthly();
    renderChart5GradesGeneral(filteredGrades, filteredStudents);
    renderChart6GradesCourse(filteredGrades);
    renderChart7Communications();
}

/**
 * Update the Top KPI Stats Cards
 */
function updateKPICards(students, attendance, grades) {
    // KPI 1: Total Students Count
    document.getElementById('kpi-students-value').textContent = students.length;
    document.getElementById('kpi-students-subtext').textContent = 
        state.selectedLevel === 'All' ? 'Matrícula total activa' : `Nivel ${state.selectedLevel}`;

    // KPI 2: Overall Attendance %
    let totalPresent = 0;
    let totalAbsent = 0;
    attendance.forEach(c => {
        totalPresent += Number(c.presentes || 0);
        totalAbsent += Number(c.ausentes || 0);
    });
    const totalAttendanceClases = totalPresent + totalAbsent;
    const attendancePercentage = totalAttendanceClases > 0 
        ? ((totalPresent / totalAttendanceClases) * 100).toFixed(1) + '%' 
        : '0%';
    document.getElementById('kpi-attendance-value').textContent = attendancePercentage;
    document.getElementById('kpi-attendance-subtext').textContent = `Total Clases: ${totalAttendanceClases}`;

    // KPI 3: Tasa de Aprobación (Weighted average based on student count per course)
    let weightedAprobadosSum = 0;
    let weightedStudentsCount = 0;
    grades.forEach(c => {
        // Find student count for this course
        const studentCount = students.filter(s => s.id_curso === c.id_curso).length;
        weightedAprobadosSum += (Number(c.aprobados || 0) * studentCount);
        weightedStudentsCount += studentCount;
    });
    const passRate = weightedStudentsCount > 0 
        ? ((weightedAprobadosSum / weightedStudentsCount) * 100).toFixed(1) + '%' 
        : '0%';
    document.getElementById('kpi-grades-value').textContent = passRate;
    document.getElementById('kpi-grades-subtext').textContent = `Promedio institucional ponderado`;

    // KPI 4: Communications efficiency (Entregados sin error)
    if (state.comms && state.comms.total > 0) {
        const commsEfficacy = ((state.comms.entregados / state.comms.total) * 100).toFixed(1) + '%';
        document.getElementById('kpi-comms-value').textContent = commsEfficacy;
        document.getElementById('kpi-comms-subtext').textContent = `Entregados: ${state.comms.entregados} / ${state.comms.total}`;
    } else {
        document.getElementById('kpi-comms-value').textContent = '-';
        document.getElementById('kpi-comms-subtext').textContent = 'No hay datos';
    }
}

/**
 * 1. Pie Chart - Composición del alumnado por nivel
 * Displays student count breakdown. Dynamic: shows courses if a single level is selected.
 */
function renderChart1Composition(students) {
    const isAll = state.selectedLevel === 'All';
    let labels = [];
    let data = [];
    
    if (isAll) {
        // Group by Nivel
        const groups = {};
        students.forEach(s => {
            groups[s.nivel] = (groups[s.nivel] || 0) + 1;
        });
        labels = Object.keys(groups);
        data = Object.values(groups);
    } else {
        // Group by Course within the selected Level
        const groups = {};
        students.forEach(s => {
            groups[s.curso] = (groups[s.curso] || 0) + 1;
        });
        labels = Object.keys(groups);
        data = Object.values(groups);
    }

    const config = {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    COLORS.primary,
                    COLORS.secondary,
                    COLORS.success,
                    COLORS.warning,
                    COLORS.info,
                    COLORS.danger
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    };

    renderChart('chart-composition', config);
}

/**
 * 2. Line Chart Stacked - Nivel de asistencia general
 * Shows presents vs absents stacked areas.
 */
function renderChart2AttendanceGeneral(attendance) {
    let labels = [];
    let presents = [];
    let absents = [];

    if (state.selectedLevel === 'All') {
        // Stacked by education Level: Inicial, Primario, Secundario
        const levels = ['Inicial', 'Primario', 'Secundario'];
        labels = levels;
        levels.forEach(lvl => {
            const coursesInLvl = attendance.filter(a => a.nivel === lvl);
            const pres = coursesInLvl.reduce((sum, c) => sum + Number(c.presentes || 0), 0);
            const abs = coursesInLvl.reduce((sum, c) => sum + Number(c.ausentes || 0), 0);
            presents.push(pres);
            absents.push(abs);
        });
    } else {
        // Stacked by individual Course within the selected Level
        attendance.forEach(c => {
            labels.push(c.curso);
            presents.push(Number(c.presentes || 0));
            absents.push(Number(c.ausentes || 0));
        });
    }

    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Presentes',
                    data: presents,
                    borderColor: COLORS.successSolid,
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2
                },
                {
                    label: 'Ausentes',
                    data: absents,
                    borderColor: COLORS.dangerSolid,
                    backgroundColor: 'rgba(239, 68, 68, 0.25)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    stacked: true,
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Cantidad de Alumnos', color: COLORS.muted }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    renderChart('chart-attendance-general', config);
}

/**
 * 3. Vertical Bar - Comparación de niveles de asistencia por curso
 * Grouped columns comparing Present vs Absent per course
 */
function renderChart3AttendanceCourse(attendance) {
    const labels = attendance.map(c => c.curso);
    const presents = attendance.map(c => Number(c.presentes || 0));
    const absents = attendance.map(c => Number(c.ausentes || 0));

    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Presentes',
                    data: presents,
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primarySolid,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Ausentes',
                    data: absents,
                    backgroundColor: COLORS.danger,
                    borderColor: COLORS.dangerSolid,
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Cantidad de Alumnos', color: COLORS.muted }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    renderChart('chart-attendance-course', config);
}

/**
 * 4. Linear Scale - Evolución anual de nivel de asistencia por mes
 * Line chart with explicit Y-axis linear percentage scale
 */
function renderChart4AttendanceMonthly() {
    // Sort monthly attendance chronologically by nro_mes
    const sortedHistory = [...state.monthlyAttendance].sort((a, b) => a.nro_mes - b.nro_mes);
    
    const labels = sortedHistory.map(h => h.mes.charAt(0).toUpperCase() + h.mes.slice(1));
    const values = sortedHistory.map(h => (Number(h.asistencia) * 100).toFixed(1));

    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Porcentaje Asistencia',
                data: values,
                borderColor: COLORS.infoSolid,
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true,
                borderWidth: 3,
                tension: 0.3,
                pointBackgroundColor: COLORS.infoSolid,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    min: 0,
                    max: 100,
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Tasa de Asistencia (%)', color: COLORS.muted }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    };

    renderChart('chart-attendance-monthly', config);
}

/**
 * 5. Stacked Bar - Nivel general de calificaciones (aprobados vs desaprobados)
 * Shows passing/failing percentage as full stacked bars
 */
function renderChart5GradesGeneral(grades, students) {
    let labels = [];
    let passRates = [];
    let failRates = [];

    if (state.selectedLevel === 'All') {
        // Stacked by Level: Inicial, Primario, Secundario
        const levels = ['Inicial', 'Primario', 'Secundario'];
        labels = levels;
        levels.forEach(lvl => {
            const gradesInLvl = grades.filter(g => g.nivel === lvl);
            let weightedPass = 0;
            let totalStudentsCount = 0;
            
            gradesInLvl.forEach(c => {
                const count = students.filter(s => s.id_curso === c.id_curso).length;
                weightedPass += (Number(c.aprobados || 0) * count);
                totalStudentsCount += count;
            });

            const passPercent = totalStudentsCount > 0 
                ? (weightedPass / totalStudentsCount) * 100 
                : 0;
            
            passRates.push(passPercent.toFixed(1));
            failRates.push((100 - passPercent).toFixed(1));
        });
    } else {
        // Single overall summary bar for the selected Level
        labels = [state.selectedLevel];
        let weightedPass = 0;
        let totalStudentsCount = 0;

        grades.forEach(c => {
            const count = students.filter(s => s.id_curso === c.id_curso).length;
            weightedPass += (Number(c.aprobados || 0) * count);
            totalStudentsCount += count;
        });

        const passPercent = totalStudentsCount > 0 
            ? (weightedPass / totalStudentsCount) * 100 
            : 0;

        passRates.push(passPercent.toFixed(1));
        failRates.push((100 - passPercent).toFixed(1));
    }

    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Aprobados (%)',
                    data: passRates,
                    backgroundColor: COLORS.success,
                    borderColor: COLORS.successSolid,
                    borderWidth: 1
                },
                {
                    label: 'Desaprobados (%)',
                    data: failRates,
                    backgroundColor: COLORS.danger,
                    borderColor: COLORS.dangerSolid,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    min: 0,
                    max: 100,
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Distribución (%)', color: COLORS.muted }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    renderChart('chart-grades-general', config);
}

/**
 * 6. Horizontal Bar - Comparativa de niveles de calificaciones por curso
 * Stacked horizontal bars (0-100%) for each course.
 */
function renderChart6GradesCourse(grades) {
    const labels = grades.map(c => c.curso);
    const passRates = grades.map(c => (Number(c.aprobados) * 100).toFixed(1));
    const failRates = grades.map(c => (Number(c.desaprobados) * 100).toFixed(1));

    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Aprobados (%)',
                    data: passRates,
                    backgroundColor: COLORS.success,
                    borderColor: COLORS.successSolid,
                    borderWidth: 1,
                    borderRadius: { topLeft: 4, bottomLeft: 4 }
                },
                {
                    label: 'Desaprobados (%)',
                    data: failRates,
                    backgroundColor: COLORS.danger,
                    borderColor: COLORS.dangerSolid,
                    borderWidth: 1,
                    borderRadius: { topRight: 4, bottomRight: 4 }
                }
            ]
        },
        options: {
            indexAxis: 'y', // Makes the bar chart horizontal
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    min: 0,
                    max: 100,
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Distribución (%)', color: COLORS.muted }
                },
                y: {
                    stacked: true,
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    renderChart('chart-grades-course', config);
}

/**
 * 7. Multi series - Estado de situación de envío de comunicados
 * A multi-series bar chart showing total, delivered, pending, and error records.
 */
function renderChart7Communications() {
    const data = state.comms || { total: 0, entregados: 0, pendientes: 0, error: 0 };
    
    // We construct it as a multi-series bar chart where each state metric has its own series (dataset)
    const config = {
        type: 'bar',
        data: {
            labels: ['Total Envíos', 'Detalle de Situación'],
            datasets: [
                {
                    label: 'Entregados',
                    data: [0, data.entregados], // placed in details
                    backgroundColor: COLORS.success,
                    borderColor: COLORS.successSolid,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Pendientes',
                    data: [0, data.pendientes],
                    backgroundColor: COLORS.warning,
                    borderColor: COLORS.warningSolid,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Errores',
                    data: [0, data.error],
                    backgroundColor: COLORS.danger,
                    borderColor: COLORS.dangerSolid,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Total General',
                    data: [data.total, 0], // placed in total
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primarySolid,
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: COLORS.gridLines },
                    title: { display: true, text: 'Cantidad de Comunicados', color: COLORS.muted }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    renderChart('chart-comunicados', config);
}
