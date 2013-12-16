var camera, scene, renderer, disk, height_map, cities, projector, voroni,
    diagram, locator, time = 0, dialogue = false, city_name_banner = $("#namebanner"), 
    status_banner = $("#statusbanner"), dialogue_banner = $("#dialoguebanner"),
    home, fortress, port, player, advancing = 0, tickets = 1, daughter = false, help = 0,
    scheduled_events = {};

city_name_banner.hide();
dialogue_banner.hide();

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

function generate_cities(height_map, radius, n, max_tickets) {
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
        var city = {
            name: town_names.pop(), 
            position: v, 
            height: h, 
            x: v.x, 
            y: v.y, 
            population: Math.floor(Math.random()*100)*100,
            ticket: max_tickets > 0 && Math.random() > 0.5,
            friendliness: Math.random(),
            inquisition: Math.random() > 0.8
        };
        var options = [];
        options.push({text: "Search for another ticket.", func: function () {
            var duration = Math.random() * 24 + 12;
            scheduled_events[time+duration] = function () {
                if (city.ticket) {
                    tickets++;
                    city.ticket = false;
                    display_dialogue(
                        "You find a man with a ticket for the ship to Aretta who gives it to you after hearing of " +
                            "your plight (and coming to a reasonable price. You walk away from the deal beaming, now " +
                            "having " + (tickets > 0 ? tickets : "no") + " ticket" + (tickets == 1 ? "" : "s") + ".",
                        [{text: "Onwards!", func: function () {dialogue = false;}}]
                    );
                } else {
                    display_dialogue(
                        "Several people confessed to having tickets, but none were willing to part with them for " +
                            "any price.",
                        [{text: "Alas.", func: function () {dialogue = false;}}]
                    );
                }
            };
            dialogue = false;
            advancing = time + duration;
            city_name_banner.text("Searching");
            city_name_banner.show()
        }});
        if (city.friendliness > 0.5 && !daughter) {
            options.push({text: "Enlist the locals help.", func: function () {
                var duration = Math.random() * 8 + 4;
                scheduled_events[time+duration] = function () {
                    if (Math.random() < city.friendliness) {
                        help++;
                        display_dialogue(
                            "Upon hearing your tale of woe, several men offered their services free of charge " +
                                "to help you storm the inquisitorial fortress and free your daughter.",
                            [{text: "Huzzar!", func: function () {dialogue = false;}}]
                        );
                    } else {
                        display_dialogue(
                            "It was often remarked that your tale was sad, but your pleas for help fell on deaf ears.",
                            [{text: "Alas.", func: function () {dialogue = false;}}]
                        );
                    }
                };
                dialogue = false;
                advancing = time + duration;
                city_name_banner.text("Enlisting");
                city_name_banner.show()
            }});
        }
        if (city.inquisition && !daughter) {
            options.push({text: "Raid the inquisition tower for information.", func: function () {
                var duration = Math.random() * 10 + 8;
                scheduled_events[time+duration] = function () {
                    if (Math.random() > 0.8) {
                        help += 3;
                        display_dialogue(
                            "The guards were asleep and the doors unlocked, you managed to get in and out before " +
                                "anyone noticed. The plans and rotas you stole will be of great use.",
                            [{text: "Huzzar!", func: function () {dialogue = false;}}]
                        );
                    } else if (Math.random() < 0.1) {
                        help -= 5;
                        tickets = 0;
                        display_dialogue(
                            "The guards caught you in the inquisitors chamber and you barely escaped with your life, " +
                                "what's more you realise you left your satchel in the tower and they now know you're " +
                                "coming.",
                            [{text: "Fuck!", func: function () {dialogue = false;}}]
                        );
                    } else {
                        display_dialogue(
                            "You daren't go further than the barracks, too many guards made you fear for your life. " +
                                "At least you weren't noticed.",
                            [{text: "What a waste of time.", func: function () {dialogue = false;}}]
                        );
                    }
                };
                dialogue = false;
                city.inquisition = false;
                advancing = time + duration;
                city_name_banner.text("Raiding");
                city_name_banner.show()
            }});
        }
        city.options = options;
        cities.push(city);
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

function display_dialogue(text, options) {
    dialogue_banner.html("<p>" + text + "</p>");
    for (var a in options) {
        var link = $("<a/>", {href: "javascript:void(0)"});
        link.html(options[a].text + "<br>");
        link.click(options[a].func);
        dialogue_banner.append(link);
    }
    dialogue = true;
    dialogue_banner.show();
}

document.body.onload = function () {
    renderer = new THREE.WebGLRenderer();
    projector = new THREE.Projector();
    voroni = new Voronoi();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, -60, 50);
    camera.lookAt(new THREE.Vector3(0,0,-15));
    
    scene = new THREE.Scene();
    
    var gradient_source = document.getElementById("ground_tex");
    var gradient_canvas = document.createElement("canvas").getContext("2d");
    gradient_canvas.canvas.width = 256;
    gradient_canvas.canvas.height = 1;
    gradient_canvas.drawImage(gradient_source,0,0);

    var ground = {
        water_level: 125,
        water_level_tex: 153,
        gradient: gradient_canvas.getImageData(0,0,256,1).data
    }, targets = {
        texture: document.createElement("canvas").getContext("2d"),
        bump: document.createElement("canvas").getContext("2d"),
        specular: document.createElement("canvas").getContext("2d")
    };
    height_map = create_heightmap(targets, 512, 0.2, {x: 0, y:0}, ground, +new Date);
    disk = create_disk(targets);
    scene.add(disk);
    
    locator = new THREE.Mesh(
        //new THREE.CylinderGeometry(0.5, 0, 1, 3, 1, false),
        new THREE.CylinderGeometry(0, 1, 8, 3),
        new THREE.MeshBasicMaterial({color: 0x52F00A})
    );
    scene.add(locator);
    
    cities = generate_cities(height_map, 512, 32, 10);
    home = random_element(cities);
    player = home;
    while (fortress == home || fortress == undefined) {
        fortress = random_element(cities);
    }
    while (port == home || port == undefined) {
        port = random_element(cities);
    }
    diagram = voroni.compute(cities, {xl: -513, xr: 513, yt: -513 ,yb: 513});
    
    for (var n in cities) {
        var city = cities[n];
        var marker_colour = 0xffffff;
        if (city.voronoiId == home.voronoiId) {
            marker_colour = 0x46F21B;
        } else if (city.voronoiId == fortress.voronoiId) {
            marker_colour = 0xE85669;
            city.options.push({text: "Free your daughter!", func: function () {
                if (daughter) {
                    display_dialogue(
                        "Your daughter reminds you she is free and that you should go to the port now.",
                        [{text: "How could I forget?.", func: function() {dialogue = false}}]
                    );
                } else {
                    var chance = 0.2 + (help / 10);
                    if (Math.random() < chance) {
                        daughter = true;
                        display_dialogue(
                            "You slip into the fortress and free your daughter! It was hit and miss at times, " +
                                "but you escape unseen and unharmed. You wish you could stop to savour the moment " +
                                "but you know you must now get to the port.",
                            [{text: "Time is of the essence!.", func: function() {dialogue = false}}]
                        );
                    } else {
                        display_dialogue(
                            "The inquisition catch you as you get to your daughter's cell and take the opportunity to " +
                                "execute you there and then. You spend your last moments watching your daughter recoil " +
                                "in terror as the inquisitor opens her cell as she is next. Game Over.",
                            [{text: "Try Again?", func: function() {window.location = window.location}}]
                        );
                    }
                }
            }});
        } else if (city.voronoiId == port.voronoiId) {
            marker_colour = 0x4592D1;
            city.options.push({text: "Board the ship", func: function () {
                if (!daughter && tickets > 0) {
                    display_dialogue(
                        "Are you sure you want to leave for Aretta without your daughter?",
                        [{text: "Yes, nothing can be done for her.", func: function () {
                            display_dialogue(
                                "You spend the remaining time on the ship waiting for it to sail away thinking of" +
                                    "your daughter. Inquisitors come to the docks and hand out flyers informing you" +
                                    "that they have killed her, leaving you grief stricken and lost. Game Over.",
                                [{text: "Try Again?", func: function() {window.location = window.location}}]
                            );
                        }}, {text: "No, I must find and rescue her!", func: function () {dialogue = false;}}]
                    );
                } else if (daughter && tickets == 1) {
                    display_dialogue(
                        "The man at the gangplank refuses you entry without tickets for both you and your daughter.",
                        [{text: "I shall board the ship without my daughter.", func: function () {
                            display_dialogue(
                                "The inquisition take the opportunity to seize your daughter as she cries for her " +
                                    "betrayal from the docks and drag her away for execution leaving you grief " +
                                    "stricken and lost at your own monstrosity. Game Over.",
                                [{text: "Try Again?", func: function() {window.location = window.location}}]
                            );
                        }}, {text: "I shall send my daughter in my place.", func: function () {
                            display_dialogue(
                                "The inquisition take the opportunity to seize you as your daughter boards the ship. " +
                                    "Your last days are spent in an inquisition cell awaiting your own execution, but " +
                                    "you die knowning your daughter was safe. Game Over.",
                                [{text: "Try Again?", func: function() {window.location = window.location}}]
                            );
                        }}, {
                            text: "I must find another ticket!", 
                            func: function () {dialogue = false;}
                        }]
                    );
                } else if (daughter && tickets == 0) {
                    display_dialogue(
                        "The man at the gangplank refuses you entry without tickets for both you and your daughter.",
                        [{
                            text: "I must find more tickets!", 
                            func: function () {dialogue = false;}
                        }]
                    );
                } else if (daughter && tickets > 1) {
                    display_dialogue(
                        "You and your daughter board the ship together and spend the time before the ship departs in " +
                            "relative comfort knowing you are both safe from the inquisition.",
                        [{text: "Try Again?", func: function() {window.location = window.location}}]
                    );
                } else {
                    display_dialogue(
                        "The man at the gangplank refuses you entry without tickets.",
                        [{
                            text: "I must find more tickets and my daughter!", 
                            func: function () {dialogue = false;}
                        }]
                    );
                }
            }});
        }
        city.neighbours = get_neighbours(city, diagram);
        var spot = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 4, 4),
            new THREE.MeshBasicMaterial({color: marker_colour})
        );
        var pos = city.position.clone();
        pos.multiplyScalar(50/512);
        pos.y = -pos.y;
        spot.position = pos;
        scene.add(spot);
        city.marker = spot;
        targets.texture.fillStyle = "black";
        targets.texture.fillRect(city.position.x+512-5,city.position.y+512-5,10,10);
    }
    disk.material.map.needsUpdate = true;

    var light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(50,50,50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x202020));
    
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize, false);
    
    function select_city(event) {
        var vector = new THREE.Vector3(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight ) * 2 + 1,
            0.5
        );
        var raycaster = projector.pickingRay(vector, camera);
        var intersections = raycaster.intersectObject(disk);
        if (intersections.length > 0) {
            var point = intersections[0].point;
            point.y = -point.y;
            point.multiplyScalar(512/50);
            for (var c in cities) {
                var d = point.distanceTo(cities[c].position);
                if (d < 25) {
                    return cities[c];
                }
            }
        }
    }
    window.addEventListener("mousedown", function (e) {
        if (time < advancing || dialogue) return;
        var city = select_city(e);
        if (city != undefined) {
            var path = find_path(player, city, height_map);
            advancing += follow_path(player, path, height_map);
            player = city;
            city_name_banner.show();
            city_name_banner.text("Travelling to " + player.name + ", eta " + hours_to_date(advancing));
            console.log(describe_city(player));
            scheduled_events[advancing] = function () {
                display_dialogue(describe_city(city), city.options.concat([
                    {text: "Continue on your way.", func: function () {dialogue = false}}
                ]));
            }
        }
        
    }, false);
    window.addEventListener("mousemove", function (e) {
        if (time < advancing || dialogue) {
            return;
        }
        var city = select_city(e);
        if (city == undefined) {
            city_name_banner.hide();
        } else {
            city_name_banner.show();
            var text = city.name;
            if (city.voronoiId == home.voronoiId) {
                text = "Your home city, " + text;
            } else if (city.voronoiId == port.voronoiId) {
                text = "Port " + text;
            } else if (city.voronoiId == fortress.voronoiId) {
                text = "The inquisition fortress, " + text;
            }
            if (city.voronoiId == player.voronoiId) {
                text += " (You are here)";
            } else {
                var path = find_path(player, city, height_map);
                var cost = follow_path(player, path, height_map);
                text += " (" + Math.ceil(cost) + " hours away)";
            }
            city_name_banner.text(text);
        }
        
    }, false);

    function animate() {
        requestAnimationFrame(animate);
        if (time < advancing && !dialogue) {
            var t = time;
            if (advancing - time < 1/20) {
                time = advancing;
                city_name_banner.hide();
            } else {
                time += (advancing - time) / 60;
            }
            for (var e in scheduled_events) {
                if (e > t && time >= e) {
                    scheduled_events[e]();
                }
            }
        }
        light.position.set(
                Math.sin(Math.PI*2/24*(time-4)) * 50,
                50,
                Math.cos(Math.PI*2/24*(time-4)) * 50
        );
        locator.position.set(player.x*50/512, -player.y*50/512, 8);
        locator.rotateY(0.01);
        renderer.render(scene, camera);
        status_banner.text(hours_to_date(time));
        if (!dialogue) dialogue_banner.hide();
    }
    animate();
    
    scheduled_events[30 * 24] = function () {
        display_dialogue(
            "The realisation that all is lost slowly dawns on you. The last ship to Aretta has sailed" +
                (!daughter ? " and your only daughter will likely be burned at the stake for your sins" : "") +
                ". The inquisition will find you eventually and burn you " + (daughter ? "and your daughter" : "too") + 
                ", your flight more than proof to them of your guilt. Game Over.",
            [{text: "Try Again?", func: function() {window.location = window.location}}]
        );
    };
    
    display_dialogue(
        "It was late evening on Saturday the 10th of February and there had been a knock at your door, " +
        "outside stood a number of large men who said they needed to speak with you. You said you were " +
        "busy but they pressed the matter so you let them in. This was the first mistake. They were from " +
        "the inquisition, you had been accused of heresy and were instructed to make your way to the " +
        "inquisition fortress of " + fortress.name + " by " + hours_to_date(24 * 30) + ". To ensure your " +
        "cooperation they took your daughter, your one and only remaining family member, hostage. If you " +
        "didn't submit yourself, they would take this as proof of your guilt and punish her in your stead.",
        [
            {text: "Continue", func: function () {
                display_dialogue(
                    "Once the inquisition had left, there was a second knock at the door. This time it was " +
                    "the local lord. He told you he had no love of the inquisition and was willing to offer " +
                    "you safe passage to Aretta on a boat leaving from Port " + port.name + ". However, no " +
                    "natter how much you begged he could not, or would not, offer you a second ticket. It " +
                    "was too dangerous, he said. Just get to " + port.name + ". Once the lord had left, you " +
                    "began to pack your things. You had to rescue your daughter from the fortress, but did " +
                    "not know how even to begin. You needed another ticket, found from somewhere. And you " +
                    "needed to make your way to " + port.name + ", all before " + hours_to_date(24 * 30) + ".",
                    [{text: "Let's go", func: function () {dialogue = false}}]
                )
            }}
        ]
    );
}
