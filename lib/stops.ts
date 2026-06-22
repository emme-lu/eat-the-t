export type Stop = {
  id: string;
  name: string;
};

export type Branch = {
  id: string;
  name: string;
  stops: Stop[];
};

export type Line = {
  id: string;
  name: string;
  color: string;
  textColor: string;
  // Stops shared by every branch of this line (rendered once, keyed by trunk.id)
  trunk?: {
    id: string;
    stops: Stop[];
  };
  branches: Branch[];
};

function s(name: string): Stop {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
  };
}

export const lines: Line[] = [
  {
    id: "red",
    name: "Red Line",
    color: "#DA291C",
    textColor: "#ffffff",
    branches: [
      {
        id: "red-trunk",
        name: "Alewife – JFK/UMass",
        stops: [
          s("Alewife"),
          s("Davis"),
          s("Porter"),
          s("Harvard"),
          s("Central"),
          s("Kendall/MIT"),
          s("Charles/MGH"),
          s("Park Street"),
          s("Downtown Crossing"),
          s("South Station"),
          s("Broadway"),
          s("Andrew"),
          s("JFK/UMass"),
        ],
      },
      {
        id: "red-ashmont",
        name: "Ashmont Branch",
        stops: [
          s("Savin Hill"),
          s("Fields Corner"),
          s("Shawmut"),
          s("Ashmont"),
        ],
      },
      {
        id: "red-braintree",
        name: "Braintree Branch",
        stops: [
          s("North Quincy"),
          s("Wollaston"),
          s("Quincy Center"),
          s("Quincy Adams"),
          s("Braintree"),
        ],
      },
    ],
  },
  {
    id: "orange",
    name: "Orange Line",
    color: "#ED8B00",
    textColor: "#ffffff",
    branches: [
      {
        id: "orange-main",
        name: "Oak Grove – Forest Hills",
        stops: [
          s("Oak Grove"),
          s("Malden Center"),
          s("Wellington"),
          s("Assembly"),
          s("Sullivan Square"),
          s("Community College"),
          s("North Station"),
          s("Haymarket"),
          s("State"),
          s("Downtown Crossing"),
          s("Chinatown"),
          s("Tufts Medical Center"),
          s("Back Bay"),
          s("Massachusetts Ave"),
          s("Ruggles"),
          s("Roxbury Crossing"),
          s("Jackson Square"),
          s("Stony Brook"),
          s("Green Street"),
          s("Forest Hills"),
        ],
      },
    ],
  },
  {
    id: "blue",
    name: "Blue Line",
    color: "#003DA5",
    textColor: "#ffffff",
    branches: [
      {
        id: "blue-main",
        name: "Bowdoin – Wonderland",
        stops: [
          s("Bowdoin"),
          s("Government Center"),
          s("State"),
          s("Aquarium"),
          s("Maverick"),
          s("Airport"),
          s("Wood Island"),
          s("Orient Heights"),
          s("Suffolk Downs"),
          s("Beachmont"),
          s("Revere Beach"),
          s("Wonderland"),
        ],
      },
    ],
  },
  {
    id: "green",
    name: "Green Line",
    color: "#00843D",
    textColor: "#ffffff",
    // Kenmore → Lechmere: shared by all four branches (B, C, D, E)
    trunk: {
      id: "green-trunk",
      stops: [
        s("Kenmore"),
        s("Hynes Convention Center"),
        s("Copley"),
        s("Arlington"),
        s("Boylston"),
        s("Park Street"),
        s("Government Center"),
        s("Haymarket"),
        s("North Station"),
        s("Science Park/West End"),
        s("Lechmere"),
      ],
    },
    branches: [
      {
        id: "green-b",
        name: "B – Boston College",
        // Unique to B: western stops + GLX spur to Union Square
        stops: [
          s("Boston College"),
          s("South Street"),
          s("Chestnut Hill Ave"),
          s("Sutherland Road"),
          s("Washington Street"),
          s("Warren Street"),
          s("Allston Street"),
          s("Griggs Street"),
          s("Harvard Ave"),
          s("Packards Corner"),
          s("Babcock Street"),
          s("Pleasant Street"),
          s("St. Paul Street (B)"),
          s("Boston University West"),
          s("Boston University Central"),
          s("Boston University East"),
          s("Blandford Street"),
          s("East Somerville"),
          s("Union Square"),
        ],
      },
      {
        id: "green-c",
        name: "C – Cleveland Circle",
        stops: [
          s("Cleveland Circle"),
          s("Englewood Ave"),
          s("Dean Road"),
          s("Tappan Street"),
          s("Washington Square"),
          s("Fairbanks Street"),
          s("Brandon Hall"),
          s("Summit Ave"),
          s("Coolidge Corner"),
          s("St. Paul Street (C)"),
          s("Kent Street"),
          s("Hawes Street"),
          s("Saint Mary's Street"),
        ],
      },
      {
        id: "green-d",
        name: "D – Riverside",
        // Unique to D: western stops + GLX extension to Medford/Tufts
        stops: [
          s("Riverside"),
          s("Woodland"),
          s("Waban"),
          s("Eliot"),
          s("Newton Highlands"),
          s("Newton Centre"),
          s("Chestnut Hill"),
          s("Reservoir"),
          s("Beaconsfield"),
          s("Brookline Hills"),
          s("Brookline Village"),
          s("Longwood"),
          s("Fenway"),
          s("East Somerville"),
          s("Gilman Square"),
          s("Magoun Square"),
          s("Ball Square"),
          s("Medford/Tufts"),
        ],
      },
      {
        id: "green-e",
        name: "E – Heath Street",
        // E diverges at Copley (first trunk stop) heading south
        stops: [
          s("Heath Street"),
          s("Back of the Hill"),
          s("Riverway"),
          s("Mission Park"),
          s("Fenwood Road"),
          s("Brigham Circle"),
          s("Longwood Medical Area"),
          s("Museum of Fine Arts"),
          s("Northeastern"),
          s("Symphony"),
          s("Prudential"),
        ],
      },
    ],
  },
];
