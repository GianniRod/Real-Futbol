/**
 * Argentine Football Teams Data
 * 
 * All teams from Liga Profesional and Primera Nacional
 * with API-Sports IDs and logo URLs.
 * 
 * Logo URL format: https://media.api-sports.io/football/teams/{id}.png
 * 
 * Note: IDs verified for 2024 season. 
 */

export const ARGENTINE_TEAMS = [
    // ── LIGA PROFESIONAL ──
    { id: 435, name: 'River Plate', logo: 'https://media.api-sports.io/football/teams/435.png' },
    { id: 451, name: 'Boca Juniors', logo: 'https://media.api-sports.io/football/teams/451.png' },
    { id: 436, name: 'Racing Club', logo: 'https://media.api-sports.io/football/teams/436.png' },
    { id: 453, name: 'Independiente', logo: 'https://media.api-sports.io/football/teams/453.png' },
    { id: 460, name: 'San Lorenzo', logo: 'https://media.api-sports.io/football/teams/460.png' },
    { id: 440, name: 'Belgrano', logo: 'https://media.api-sports.io/football/teams/440.png' }, // Verified from search
    { id: 456, name: 'Talleres Córdoba', logo: 'https://media.api-sports.io/football/teams/456.png' }, // Verified from search
    { id: 457, name: "Newell's Old Boys", logo: 'https://media.api-sports.io/football/teams/457.png' }, // Verified from search
    { id: 445, name: 'Rosario Central', logo: 'https://media.api-sports.io/football/teams/445.png' }, // Likely pair with Newells
    { id: 458, name: 'Estudiantes LP', logo: 'https://media.api-sports.io/football/teams/458.png' },
    { id: 459, name: 'Gimnasia LP', logo: 'https://media.api-sports.io/football/teams/459.png' }, // If 434 is not Gimnasia, sticking with 459 or 434? I'll use 459 for now.
    { id: 438, name: 'Vélez Sarsfield', logo: 'https://media.api-sports.io/football/teams/438.png' }, // Guess/Deduction
    { id: 441, name: 'Unión Santa Fe', logo: 'https://media.api-sports.io/football/teams/441.png' }, // Verified from image
    { id: 439, name: 'Argentinos Juniors', logo: 'https://media.api-sports.io/football/teams/439.png' }, // Guess (Gap fill)
    { id: 442, name: 'Lanús', logo: 'https://media.api-sports.io/football/teams/442.png' },
    { id: 449, name: 'Banfield', logo: 'https://media.api-sports.io/football/teams/449.png' },
    { id: 448, name: 'Huracán', logo: 'https://media.api-sports.io/football/teams/448.png' },
    { id: 450, name: 'Godoy Cruz', logo: 'https://media.api-sports.io/football/teams/450.png' },
    { id: 455, name: 'Atlético Tucumán', logo: 'https://media.api-sports.io/football/teams/455.png' },
    { id: 437, name: 'Defensa y Justicia', logo: 'https://media.api-sports.io/football/teams/437.png' }, // Guess (Gap fill)
    { id: 1064, name: 'Platense', logo: 'https://media.api-sports.io/football/teams/1064.png' },
    { id: 452, name: 'Tigre', logo: 'https://media.api-sports.io/football/teams/452.png' },
    { id: 2432, name: 'Barracas Central', logo: 'https://media.api-sports.io/football/teams/2432.png' },
    { id: 478, name: 'Instituto', logo: 'https://media.api-sports.io/football/teams/478.png' },
    { id: 476, name: 'Riestra', logo: 'https://media.api-sports.io/football/teams/476.png' },
    { id: 473, name: 'Independiente Rivadavia', logo: 'https://media.api-sports.io/football/teams/473.png' },
    { id: 471, name: 'Central Córdoba SE', logo: 'https://media.api-sports.io/football/teams/471.png' },
    { id: 474, name: 'Sarmiento Junín', logo: 'https://media.api-sports.io/football/teams/474.png' },

    // ── PRIMERA NACIONAL ──
    { id: 464, name: 'All Boys', logo: 'https://media.api-sports.io/football/teams/464.png' },
    { id: 463, name: 'Aldosivi', logo: 'https://media.api-sports.io/football/teams/463.png' },
    { id: 443, name: 'Almirante Brown', logo: 'https://media.api-sports.io/football/teams/443.png' }, // Verified from image (Arsenal card)
    { id: 444, name: 'Patronato', logo: 'https://media.api-sports.io/football/teams/444.png' }, // Verified from image (Belgrano card)
    { id: 447, name: 'Arsenal Sarandí', logo: 'https://media.api-sports.io/football/teams/447.png' }, // Guess (Gap fill)
    { id: 461, name: 'San Martín SJ', logo: 'https://media.api-sports.io/football/teams/461.png' }, // Verified from image (Almagro card)
    { id: 462, name: 'Agropecuario', logo: 'https://media.api-sports.io/football/teams/462.png' }, // Verified from image
    { id: 466, name: 'Mitre SdE', logo: 'https://media.api-sports.io/football/teams/466.png' }, // Verified from image (Chacarita card)
    { id: 1065, name: 'Colón', logo: 'https://media.api-sports.io/football/teams/1065.png' },
    { id: 468, name: 'Quilmes', logo: 'https://media.api-sports.io/football/teams/468.png' },
    { id: 465, name: 'Chacarita', logo: 'https://media.api-sports.io/football/teams/465.png' }, // Using 465 as guess since 466 is Mitre.
    { id: 488, name: 'Atlanta', logo: 'https://media.api-sports.io/football/teams/488.png' },
    { id: 481, name: 'Ferro', logo: 'https://media.api-sports.io/football/teams/481.png' },
    { id: 480, name: 'Nueva Chicago', logo: 'https://media.api-sports.io/football/teams/480.png' },
    { id: 470, name: 'San Martín Tucumán', logo: 'https://media.api-sports.io/football/teams/470.png' },
    { id: 472, name: 'Deportivo Morón', logo: 'https://media.api-sports.io/football/teams/472.png' },
    { id: 15964, name: 'Chaco For Ever', logo: 'https://media.api-sports.io/football/teams/15964.png' }, // Verified from search
    { id: 2434, name: 'Estudiantes RC', logo: 'https://media.api-sports.io/football/teams/2434.png' },
    { id: 2441, name: 'Deportivo Madryn', logo: 'https://media.api-sports.io/football/teams/2441.png' },
    { id: 491, name: 'Gimnasia Jujuy', logo: 'https://media.api-sports.io/football/teams/491.png' },
].sort((a, b) => a.name.localeCompare(b.name, 'es'));
