// Tables de correspondance Apimo (codes -> libellés FR).
// Source: API Apimo /catalogs (culture=fr_FR). Ne pas éditer à la main.

export type ApimoLabelMap = Record<string, string>

export const AREATYPE_LABELS: ApimoLabelMap = {"1":"Chambre","2":"Salon","3":"Cuisine","4":"Garage","5":"Parking","6":"Cave","7":"Abri de jardin","8":"Salle de bains","9":"Buanderie","10":"Bureau","11":"Couloir","12":"Dégagement","13":"Salle de douche","14":"Dressing","15":"Entrée","16":"Toilettes","17":"Véranda","18":"Terrasse","19":"Solarium","20":"Séjour","21":"Salle de jeux","22":"Salle à manger","23":"Pool house","24":"Placard","25":"Non exploité","26":"Loggia","27":"Grenier","28":"Autre","29":"Mezzanine","30":"Cellier","31":"Local technique","32":"Atelier","33":"Studio","34":"Loft","35":"Bibliothèque","36":"Penderie","37":"Cour","38":"Palier","39":"Lingerie","40":"Sous-sol","41":"Salle de bains / toilettes","42":"Salle de douche / toilettes","43":"Balcon","44":"Salle de sport","45":"Boîte de nuit","46":"Cinéma","47":"Salle de réception","48":"Débarras","49":"Jardin","50":"Parc","51":"Terrain","52":"Patio","53":"Chambre de maître","54":"Suite","55":"Remise","56":"Appartement","57":"Cabine","58":"Grange","59":"Dépendance","60":"Local à vélos","61":"Local à skis","62":"Local à poubelles","63":"Hammam","64":"Piscine intérieure","65":"Salle de prière","66":"Sauna","67":"Mirador","68":"Salle","69":"Salle de réunion","70":"Chambre de service","71":"Studio de service","72":"Double réception","73":"Triple réception","74":"Parking intérieur","75":"Parking extérieur","76":"Stock / Réserve","77":"Commerce","78":"Cafétéria","79":"Lot","80":"Entrepôt","81":"Logement","82":"Arcade","83":"Maison","84":"Escalier","85":"Box","86":"Carnotzet","87":"Panic room","88":"Open space","89":"Hall","90":"Pièce de vie","91":"Cuisine d'été","92":"Spa","93":"Galerie","94":"Hangar à bateaux","95":"Salle à manger/Cuisine","96":"Cuisine équipée","97":"Cuisine semi-équipée","98":"Cuisine d'angle","99":"Kitchenette","100":"Cuisine américaine","101":"Parcelle","102":"Porche","103":"Séjour/cuisine","104":"Chambre d'enfants","105":"Vestiaire","106":"Hall d'entrée","107":"Toilette PMR","108":"Atelier artisanal","109":"Cave à vin","110":"Plateau","112":"Écurie","113":"Jardin d'hiver","114":"Chambre froide","115":"Chambre PMR","116":"Office","117":"Pièce de loisirs"}

export const PROXIMITY_LABELS: ApimoLabelMap = {"1":"Bus","2":"Gare routière","3":"Métro","4":"Commerces","5":"École primaire","6":"Plage","7":"Centre ville","8":"Hôpital/clinique","9":"Médecin","10":"Tram","11":"Gare","12":"Taxi","13":"Parking public","14":"Parc","15":"Supermarché","16":"Port","17":"Crèche","18":"Piscine publique","19":"Tennis","20":"Golf","21":"Cinéma","22":"Garderie","23":"École secondaire","24":"Salle de sport","25":"Aéroport","26":"Pistes de ski","27":"Mer","28":"Gare TGV","29":"Autoroute","30":"Université","31":"Palais des congrès","32":"Lac","33":"Route principale"}

export const ORIENTATION_LABELS: ApimoLabelMap = {"1":"Est","2":"Nord","3":"Ouest","4":"Sud","5":"Nord-est","6":"Sud-est","7":"Sud-ouest","8":"Nord-ouest"}

export const HEATINGTYPE_LABELS: ApimoLabelMap = {"1":"Gaz","2":"Fioul / Mazout","3":"Electrique","4":"Bois","5":"Solaire","6":"Charbon","7":"Pompe à chaleur","8":"Géothermie","9":"Granulés/Pellets de bois","10":"Eau chaude","11":"Aérothermie","12":"Copeaux de bois"}

export const HEATINGDEVICE_LABELS: ApimoLabelMap = {"1":"Convecteur","2":"Au sol","3":"Radiateur","4":"Poêle","5":"Climatisation","6":"Central","7":"Sans chauffage","8":"Cheminée"}

export const HEATINGACCESS_LABELS: ApimoLabelMap = {"1":"Individuel","2":"Collectif","3":"Mixte","4":"Urbain"}

export const HOTWATERDEVICE_LABELS: ApimoLabelMap = {"1":"Solaire","2":"Chauffe-eau","3":"Chaudière","4":"Pompe à chaleur"}

export const HOTWATERACCESS_LABELS: ApimoLabelMap = {"1":"Individuelle","2":"Collective"}

export const WASTEWATER_LABELS: ApimoLabelMap = {"1":"Fosse septique","2":"Tout à l'égout","3":"Station d'épuration","4":"Fosse toutes eaux","5":"Micro-station d'épuration"}

export const CONDITION_LABELS: ApimoLabelMap = {"1":"À rafraîchir","3":"Bon état","5":"À rénover","6":"Excellent état","7":"Brut de béton","8":"Neuf"}

export const VIEWTYPE_LABELS: ApimoLabelMap = {"1":"Vis-à-vis","2":"Aperçu","3":"Dégagée","4":"Panoramique","5":"Externe","6":"Interne"}

export const FLOOR_LABELS: ApimoLabelMap = {"1":"Rez-de-chaussée","2":"Dernier étage","3":"1er","4":"2ème","5":"3ème","6":"4ème","7":"5ème","8":"6ème","9":"7ème","10":"8ème","11":"9ème","12":"10ème","13":"11ème","14":"12ème","15":"13ème","16":"14ème","17":"15ème","18":"16ème","19":"17ème","20":"18ème","21":"19ème","22":"20ème","23":"Rez-de-jardin","24":"Entresol","25":"-1","26":"-2","27":"-3","28":"-4","29":"Sous-sol","30":"Plain-pied","31":"21ème","32":"22ème","33":"23ème","34":"24ème","35":"25ème","36":"26ème","37":"27ème","38":"28ème","39":"29ème","40":"30ème","41":"31ème","42":"32ème","43":"33ème","44":"34ème","45":"35ème","46":"36ème","47":"37ème","48":"38ème","49":"39ème","50":"40ème","51":"-5","52":"-6","53":"-7","54":"-8","55":"-9","56":"-10","57":"41ème","58":"42ème","59":"43ème","60":"44ème","61":"45ème","62":"46ème","63":"47ème","64":"48ème","65":"49ème","66":"50ème","67":"51","68":"52","69":"53","70":"54","71":"55","72":"56","73":"57","74":"58","75":"59","76":"60","77":"Surélevé","78":"61","79":"62","80":"63","81":"64","82":"65","83":"66","84":"67","85":"68","86":"69","87":"70","88":"71","89":"72","90":"73","91":"74","92":"75","93":"76","94":"77","95":"78","96":"79","97":"80","98":"81","99":"82","100":"83","101":"84","102":"85","103":"86","104":"87","105":"88","106":"89","107":"90","108":"91","109":"92","110":"93","111":"94","112":"95","113":"96","114":"97","115":"98","116":"99","117":"100"}

