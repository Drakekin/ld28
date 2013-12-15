var town_names = shuffle([
    "Verago", "Andialas", "Mola", "Cordecaya", "Villa", "Alcolar", "Pachorra", "Sago", "Cala", "Sevilla", "Greda", 
    "Murcife", "Tala", "Moste", "Ciutora", "Colmeria", "Arbavas", "Algelil", "Bari", "Adarrar", "Cartelda", 
    "Montcordo", "Vinara", "Erradas", "Tevigo", "Saurensa", "Merida", "Beirobla", "Badormun", "Barila", "Carmarte", 
    "Mahona", "Anades", "Alenas", "Bilbao", "Calesa", "Gijona", "Vina", "Adalas", "Carbendo", "Villicaya", "Cira", 
    "Suecala", "Cabra", "Astrillas", "Onorrans", "Baseste", "Antantes", "Barido", "Pina", "Mella", "Satabria", "Ciosa", 
    "Anares", "Grida", "Asemot", "Mahuela", "Castacia", "Zara", "Mana", "Vellabra", "Marbena", "Viejueza", "Teldena", 
    "Acar", "Olmeras", "Vila", "Udesar", "Bendano", "Valla", "Grinesa", "Pozamel", "Assares", "Basiera", "Masante", 
    "Montacia", "Misla", "Tillinsa", "Tomurcia", "Pledala", "Cerada", "Ferria", "Laduja", "Mena", "Cobilbao", 
    "Zuquera", "Marra", "Sueca", "Torrautza", "Bena", "Margena", "Zamolla", "Ansades", "Pachuela", "Analls", 
    "Beirago", "Cada", "Acatxils", "Ponfiga", "Tagana"
]);

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
    
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    
    return array;
}

function fbm_noise(r_lat, r_lon, frequency, octaves, gain) {
    var cap = 0;
    for (var e = 1; e <= octaves; e++) {
        cap += Math.pow(gain, e);
    }
    var total = 0;
    var amplitude = gain;
    var z = Math.sin(r_lat) * frequency;
    var x = Math.cos(r_lat) * Math.sin(r_lon) * frequency;
    var y = Math.cos(r_lat) * Math.cos(r_lon) * frequency;
    for (var i = 1; i <= octaves; i++) {      
        total += (noise.simplex3(x, y, z) + 1) / 2 * amplitude;   
        x *= frequency;
        y *= frequency;
        z *= frequency;
        amplitude *= gain;
    }
    return total / cap;
}


function create_heightmap(targets, radius, scale, origin, ground, seed) {
    noise.seed(seed);
    targets.texture.canvas.width =
        targets.texture.canvas.height =
            targets.bump.canvas.width =
                targets.bump.canvas.height =
                    targets.specular.canvas.width =
                        targets.specular.canvas.height =
                            radius * 2;
    var height_map = [];
    var max = -256;
    var min = 256;
    var r_scale = Math.PI * scale / radius, r2 = radius * radius;
    for (var y = -radius; y < radius; y++) {
        for (var x = -radius; x < radius; x++) {
            if (x*x+y*y <= r2) {
                var h = Math.floor(fbm_noise(
                    x * r_scale + origin.x, 
                    y * r_scale + origin.y, 
                    2, 5, 0.6
                ) * 256);
                var a = h - ground.water_level,
                    b = Math.max(a, 0),
                    s = a <= 0,
                    c = Math.max(Math.min(
                            (ground.gradient.length/4 - 1)-(ground.water_level_tex + a), ground.gradient.length/4 - 1
                        ), 0);
                max = Math.max(a, max);
                min = Math.min(a, min);
                height_map.push(a);
                targets.texture.fillStyle = "rgb(" + ground.gradient[c*4] + ", " + ground.gradient[c*4+1] + ", " + ground.gradient[c*4+2] + ")";
                targets.texture.fillRect(x+radius,y+radius,1,1);
                if (s) {
                    targets.specular.fillStyle = "white";
                } else {
                    targets.specular.fillStyle = "black";
                }
                targets.specular.fillRect(x+radius,y+radius,1,1);
                targets.bump.fillStyle = "rgb(" + b + ", " + b + ", " + b + ")";
                targets.bump.fillRect(x+radius,y+radius,1,1);
            } else {
                height_map.push(undefined);
            }
        }
    }
    console.log(max, min);
    return height_map;
}

function create_disk(textures) {
    var t_texture = new THREE.Texture(textures.texture.canvas),
        t_bump = new THREE.Texture(textures.bump.canvas),
        t_specular = new THREE.Texture(textures.specular.canvas);
    t_texture.needsUpdate = true;
    t_bump.needsUpdate = true;
    t_specular.needsUpdate = true;
    
    return new THREE.Mesh(
        new THREE.PlaneGeometry(100,100),
        new THREE.MeshPhongMaterial({
            map: t_texture,
            bumpMap: t_bump,
            bumpScale: 20,
            specularMap: t_specular,
            specular: new THREE.Color("grey"),
            transparent: true
        })
    );
}

function generate_cities(height_map, radius, n, tickets) {
    var cities = [];
    for (var i = 0; i < n; i++) {
        var h = undefined, x = undefined, y = undefined, v;
        while (h == undefined || h <= 10) {
            x = Math.floor(Math.random() * radius * 2);
            y = Math.floor(Math.random() * radius * 2);
            h = height_map[y*radius*2+x];
            v = new THREE.Vector3(x-radius, y-radius, 0);
            for (var c in cities) {
                if (v.distanceTo(cities[c].position) < 50 || v.distanceTo(new THREE.Vector3()) > 512 - 51) {
                    h = undefined;
                }
            }
        }
        cities.push({
            name: town_names.pop(), 
            position: v, 
            height: h, 
            x: v.x, 
            y: v.y, 
            population: Math.floor(Math.random()*100)*100,
            ticket: tickets > 0 && Math.random() > 0.5,
            friendliness: Math.random(),
            inquisition: Math.random() > 0.8
        })
    }
    return cities;
}

function describe_city(city) {
    var size, special, demeanour;
    if (city.population < 500) {
        size = "village";
    } else if (city.population < 2000) {
        size = "town";
    } else if (city.population < 5000) {
        size = "township";
    } else {
        size = "city";
    }
    if (city.voronoiId == home.voronoiId) {
        special = "your home city";
    } else if (city.voronoiId == port.voronoiId) {
        special = "the port from which the boat to Aretta will leave";
    } else if (city.voronoiId == fortress.voronoiId) {
        special = "the fortress " + size + " of the inquisition";
    }
    if (city.friendliness > 0.75 && Math.random() > 0.25) {
        demeanour = "The people of " + city.name + " are very friendly. "
    } else if (city.friendliness < 0.25 && Math.random() > 0.25) {
        demeanour = "The " + size + "'s inhabitants want nothing to do with you. " + 
            "You wonder if the inquisition have been through this town. "
    } else if (Math.random() > 0.5) {
        demeanour = "";
    }
    return "You arrive at the " + size + " of " + city.name + (special == undefined ? "" : ", " + special) + ". " +
        (demeanour == undefined ? "The " + size + "'s inhabitants appears generally indifferent to you. " : demeanour) +
        (city.inquisition ? "There is an inquisition tower in the middle of the " + size + ", you should not stay long. ": "");
}

function get_neighbours(city, voroni_diagram) {
    var v_id = city.voronoiId, cell;
    for (var c in voroni_diagram.cells) {
        if (voroni_diagram.cells[c].site.voronoiId == v_id) {
            cell = voroni_diagram.cells[c];
            break;
        }
    }
    var neighbours = [];
    for (var e in cell.halfedges) {
        var edge = cell.halfedges[e].edge;
        if (edge.lSite != null && edge.lSite.voronoiId != v_id) {
            neighbours.push(edge.lSite);
        }
        if (edge.rSite != null && edge.rSite.voronoiId != v_id) {
            neighbours.push(edge.rSite);
        }
    }
    return neighbours;
}

function calculate_route(start, end, height_map) {
    var route = rasterise_line(start.position.x, start.position.y, end.position.x, end.position.y);
    var sea = false;
    var cost = 0;
    var last_h = undefined;
    for (var p in route) {
        var pixel = route[p];
        var h = height_map[(512+pixel.y)*1024+pixel.x+512];
        if (last_h != undefined) {
            if (h <= 0) {
                sea = true;
                cost += 2;
            } else if (h > last_h) {
                cost += 0.6 + 0.4 * (h - last_h) / 256;
            } else {
                cost += 0.4 + 0.6 * (last_h - h) / 256;
            }
        }
        last_h = h;
    }
    return {sea: sea, cost: cost/6, start: start, end: end};
}

function rasterise_line(x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0),
        dy = Math.abs(y1 - y0),
        sx, sy, err, e2, points = [];
    if (x0 < x1) {
        sx = 1;
    } else {
        sx = -1;
    }
    if (y0 < y1) {
        sy = 1;
    } else {
        sy = -1;
    }
    err = dx - dy;
    
    while (true) {
        points.push({x: x0, y: y0});
        if (x0 == x1 && y0 == y1) break;
        e2 = 2 * err;
        if (e2 > -dy) { 
            err = err - dy;
            x0 = x0 + sx;
        }
        if (x0 == x1 && y0 == y1) { 
            points.push({x: x0, y: y0});
            break;
        }
        if (e2 <  dx) { 
            err = err + dx;
            y0 = y0 + sy ;
        }
    }
    
    return points;
}

function city_in_array(city, array) {
    for (var c in array) {
        if (array[c].voronoiId == city.voronoiId) {
            return true;
        }
    }
    return false;
}

function city_in_keys(city, array) {
    for (var c in array) {
        if (c == city.voronoiId) {
            return true;
        }
    }
    return false;
}

function find_path(start, end, height_map) {
    var closed = [], open = [start], came_from = {},
        g_score = {}, f_score = {};
    
    g_score[start.voronoiId] = 0;
    f_score[start.voronoiId] = g_score[start.voronoiId] + calculate_route(start, end, height_map);
    
    while (open.length > 0) {
        var current = null;
        var current_index;
        for (var s in open) {
            if (current == null || f_score[open[s].voronoiId] < f_score[current.voronoiId]) {
                current = open[s];
                current_index = s;
                break;
            }
        }
        if (current.voronoiId == end.voronoiId) {
            var path = [];
            while (city_in_keys(current, came_from)) {
                path = path.concat([current]);
                current = came_from[current.voronoiId]
            }
            return path;
        }
        open.splice(current_index, 1);
        closed.push(current);
        
        for (var n in current.neighbours) {
            var neighbour = current.neighbours[n];
            var tentative_g_score = g_score[current.voronoiId] + calculate_route(current, neighbour, height_map),
                tentative_f_score = tentative_g_score + calculate_route(neighbour, end, height_map);
            
            if (city_in_array(neighbour, closed) && tentative_f_score >= f_score[neighbour.voronoiId]) {
                continue;
            }
            
            if (!city_in_array(neighbour, open) || tentative_f_score < f_score[neighbour.voronoiId]) {
                came_from[neighbour.voronoiId] = current;
                g_score[neighbour.voronoiId] = tentative_g_score;
                f_score[neighbour.voronoiId] = tentative_f_score;
                if (!city_in_array(neighbour, open)) {
                    open.push(neighbour);
                }
            }
        }
    }
    return null;
}

function follow_path(start, path, height_map) {
    var current = start, cost = 0;
    while (path.length > 0) {
        var next = path.pop();
        cost += calculate_route(current, next, height_map).cost;
        current = next;
    }
    return cost;
}

function random_element(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function hours_to_date(hours) {
    hours += 9;
    var days = Math.floor(hours/24), time = Math.floor(hours % 24), months = Math.floor(days/30), day = (days + 11) % 30;
    var days_of_the_week = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ], months_of_the_year = [
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];
    var day_name = days_of_the_week[days % 7],
        month = months_of_the_year[months % 12],
        st = day == 1 ? "st" : (day == 2 ? "nd" : (day == 3 ? "rd" : "th"));
    
    var afternoon = time > 12, clock = time % 12;
    clock = clock == 0 ? 12: clock;
    return clock + " " + (afternoon ? "pm" : "am") + ", " + day_name + " the " + day + st + " of " + month
}

