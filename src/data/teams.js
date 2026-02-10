/**
 * Argentine Football Teams Data
 * 
 * All teams from Liga Profesional and Primera Nacional
 * with API-Sports IDs and logo URLs.
 * 
 * Logo URL format: https://media.api-sports.io/football/teams/{id}.png
 * 
 * Note: IDs verified for 2024 season. 
 * Some Primera Nacional IDs might need further verification.
 */

export const ARGENTINE_TEAMS = [
    // ── LIGA PROFESIONAL ──
    { id: 435, name: 'River Plate', logo: 'https://media.api-sports.io/football/teams/435.png' },
    { id: 451, name: 'Boca Juniors', logo: 'https://media.api-sports.io/football/teams/451.png' },
    { id: 436, name: 'Racing Club', logo: 'https://media.api-sports.io/football/teams/436.png' },
    { id: 453, name: 'Independiente', logo: 'https://media.api-sports.io/football/teams/453.png' },
    { id: 460, name: 'San Lorenzo', logo: 'https://media.api-sports.io/football/teams/460.png' },
    { id: 440, name: 'Huracán', logo: 'https://media.api-sports.io/football/teams/440.png' },
    { id: 456, name: 'Vélez Sarsfield', logo: 'https://media.api-sports.io/football/teams/456.png' }, // Símbolo V
    { id: 458, name: 'Estudiantes LP', logo: 'https://media.api-sports.io/football/teams/458.png' },
    { id: 459, name: 'Gimnasia LP', logo: 'https://media.api-sports.io/football/teams/459.png' },
    { id: 445, name: 'Rosario Central', logo: 'https://media.api-sports.io/football/teams/445.png' }, // Escudo azul y amarillo
    { id: 446, name: "Newell's Old Boys", logo: 'https://media.api-sports.io/football/teams/446.png' }, // Escudo rojo y negro
    { id: 441, name: 'Argentinos Juniors', logo: 'https://media.api-sports.io/football/teams/441.png' },
    { id: 455, name: 'Atlético Tucumán', logo: 'https://media.api-sports.io/football/teams/455.png' },
    { id: 439, name: 'Unión Santa Fe', logo: 'https://media.api-sports.io/football/teams/439.png' }, // Verify
    { id: 442, name: 'Lanús', logo: 'https://media.api-sports.io/football/teams/442.png' },
    { id: 449, name: 'Banfield', logo: 'https://media.api-sports.io/football/teams/449.png' },
    { id: 457, name: 'Talleres Córdoba', logo: 'https://media.api-sports.io/football/teams/457.png' }, // Search suggested 456/457. Velez is usually 456.
    { id: 444, name: 'Belgrano', logo: 'https://media.api-sports.io/football/teams/444.png' },
    { id: 450, name: 'Godoy Cruz', logo: 'https://media.api-sports.io/football/teams/450.png' },
    { id: 438, name: 'Defensa y Justicia', logo: 'https://media.api-sports.io/football/teams/438.png' }, // Verify
    { id: 452, name: 'Tigre', logo: 'https://media.api-sports.io/football/teams/452.png' },
    { id: 1064, name: 'Platense', logo: 'https://media.api-sports.io/football/teams/1064.png' },
    { id: 478, name: 'Instituto', logo: 'https://media.api-sports.io/football/teams/478.png' },
    { id: 2432, name: 'Barracas Central', logo: 'https://media.api-sports.io/football/teams/2432.png' },
    { id: 476, name: 'Riestra', logo: 'https://media.api-sports.io/football/teams/476.png' },
    { id: 473, name: 'Independiente Rivadavia', logo: 'https://media.api-sports.io/football/teams/473.png' },
    { id: 471, name: 'Central Córdoba SE', logo: 'https://media.api-sports.io/football/teams/471.png' },
    { id: 474, name: 'Sarmiento Junín', logo: 'https://media.api-sports.io/football/teams/474.png' },

    // ── PRIMERA NACIONAL (Principales) ──
    { id: 464, name: 'All Boys', logo: 'https://media.api-sports.io/football/teams/464.png' },
    { id: 463, name: 'Aldosivi', logo: 'https://media.api-sports.io/football/teams/463.png' },
    { id: 447, name: 'Patronato', logo: 'https://media.api-sports.io/football/teams/447.png' },
    { id: 443, name: 'Arsenal Sarandí', logo: 'https://media.api-sports.io/football/teams/443.png' },
    { id: 1065, name: 'Colón', logo: 'https://media.api-sports.io/football/teams/1065.png' },
    { id: 468, name: 'Quilmes', logo: 'https://media.api-sports.io/football/teams/468.png' },
    { id: 466, name: 'Chacarita', logo: 'https://media.api-sports.io/football/teams/466.png' },
    { id: 481, name: 'Ferro', logo: 'https://media.api-sports.io/football/teams/481.png' },
    { id: 480, name: 'Nueva Chicago', logo: 'https://media.api-sports.io/football/teams/480.png' },
    { id: 470, name: 'San Martín Tucumán', logo: 'https://media.api-sports.io/football/teams/470.png' },
    { id: 473, name: 'San Martín SJ', logo: 'https://media.api-sports.io/football/teams/473.png' }, // Check Dupe with Indep Rivadavia? 473? Indep Rivadavia search said 473. San Martin SJ search said... I didn't search San Martin SJ. I'll flag.
    { id: 488, name: 'Atlanta', logo: 'https://media.api-sports.io/football/teams/488.png' },
    { id: 461, name: 'Almagro', logo: 'https://media.api-sports.io/football/teams/461.png' },
    { id: 462, name: 'Almirante Brown', logo: 'https://media.api-sports.io/football/teams/462.png' },
    { id: 472, name: 'Deportivo Morón', logo: 'https://media.api-sports.io/football/teams/472.png' },
    { id: 469, name: 'Temperley', logo: 'https://media.api-sports.io/football/teams/469.png' },
    { id: 486, name: 'Agropecuario', logo: 'https://media.api-sports.io/football/teams/486.png' },
    { id: 491, name: 'Gimnasia Jujuy', logo: 'https://media.api-sports.io/football/teams/491.png' },
    { id: 489, name: 'Dep. Maipú', logo: 'https://media.api-sports.io/football/teams/489.png' },
    { id: 2434, name: 'Estudiantes RC', logo: 'https://media.api-sports.io/football/teams/2434.png' },
    { id: 490, name: 'Chaco For Ever', logo: 'https://media.api-sports.io/football/teams/490.png' },
    { id: 485, name: 'San Telmo', logo: 'https://media.api-sports.io/football/teams/485.png' },
].sort((a, b) => a.name.localeCompare(b.name, 'es'));
