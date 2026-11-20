/**
 * Today's heights from a relief tile (#1016), for the ice-age globe close up: the tile is the
 * patch's own texture (`dayMap`, which deep time leaves unused), so no sampler is added.
 *
 * Each texel is a cell's height to the metre in two bytes (red high, green low, less
 * `reliefOffset`) and where water is (blue: 255 the ocean, 128 a lake, 0 land), so texels are
 * read one at a time and blended here, never by the GPU. A point takes the four cells round it
 * for its height and the twelve round those for its slope: central differences at each of the
 * four, blended alike, so the hill shading is as smooth as the heights. The tile's border holds
 * its neighbours' cells, so none of this stops at a tile's edge.
 *
 * Needs `dayMap`, `dayRect`, `PI` and `EARTH_RADIUS_M` defined before it.
 */
export const RELIEF = /* glsl */ `
  uniform float reliefTile;
  // Cells a tile has a side, and of its border.
  uniform vec2 reliefCells;
  uniform float reliefOffset;

  // Cell (i, j) of the tile, counted east and north from its south-west cell: height and blue.
  vec2 reliefCell(vec2 ij) {
    float size = reliefCells.x + 2.0 * reliefCells.y;
    vec3 bytes = floor(texture2D(dayMap, (ij + reliefCells.y + 0.5) / size).rgb * 255.0 + 0.5);
    return vec2(bytes.r * 256.0 + bytes.g - reliefOffset, bytes.b);
  }

  float reliefHeight(vec2 ij) {
    return reliefCell(ij).x;
  }

  struct Relief {
    float height;
    // Metres up per metre east and north.
    vec2 slope;
    // How much of the point is open ocean, and lake, 0 to 1.
    float ocean;
    float lake;
  };

  Relief reliefAt(vec2 uv) {
    vec2 at = (uv - dayRect.xy) / dayRect.zw * reliefCells.x - 0.5;
    vec2 i = floor(at);
    vec2 f = at - i;
    vec2 c00 = reliefCell(i);
    vec2 c10 = reliefCell(i + vec2(1.0, 0.0));
    vec2 c01 = reliefCell(i + vec2(0.0, 1.0));
    vec2 c11 = reliefCell(i + vec2(1.0, 1.0));
    float h00 = c00.x;
    float h10 = c10.x;
    float h01 = c01.x;
    float h11 = c11.x;
    // Slopes across two cells at each of the four, east then north.
    vec4 east = vec4(
      h10 - reliefHeight(i + vec2(-1.0, 0.0)),
      reliefHeight(i + vec2(2.0, 0.0)) - h00,
      h11 - reliefHeight(i + vec2(-1.0, 1.0)),
      reliefHeight(i + vec2(2.0, 1.0)) - h01
    ) * 0.5;
    vec4 north = vec4(
      h01 - reliefHeight(i + vec2(0.0, -1.0)),
      h11 - reliefHeight(i + vec2(1.0, -1.0)),
      reliefHeight(i + vec2(0.0, 2.0)) - h00,
      reliefHeight(i + vec2(1.0, 2.0)) - h10
    ) * 0.5;
    vec4 weight = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
    vec4 blue = vec4(c00.y, c10.y, c01.y, c11.y);
    // A cell's width in metres: the tile spans dayRect's share of a circumference (east) or a
    // half (north), narrowing east-west with latitude.
    float latitude = (uv.y - 0.5) * PI;
    vec2 cell = vec2(
      2.0 * PI * EARTH_RADIUS_M * dayRect.z * max(cos(latitude), 0.05),
      PI * EARTH_RADIUS_M * dayRect.w
    ) / reliefCells.x;
    Relief relief;
    relief.height = dot(weight, vec4(h00, h10, h01, h11));
    relief.slope = vec2(dot(weight, east), dot(weight, north)) / cell;
    relief.ocean = dot(weight, step(191.5, blue));
    relief.lake = dot(weight, step(63.5, blue) * (1.0 - step(191.5, blue)));
    return relief;
  }
`;
