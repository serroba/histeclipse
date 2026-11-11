/**
 * Sea ice on the Earth shader: today's maps and an ice-age model's, each the most ice in the
 * year and the ice that lasts all year (bytes in 0.4% steps, 250 full cover), blended
 * `seaIceMix` of the way to the ice age's. Needs `srgb` defined before it.
 *
 * `seaIceSeason` below 0 draws the ice-age scale's two tones: solid white where the ice lasts
 * all year, fainter where it forms only in winter. From 0 to 1 it is the time of year in the
 * years: how far the north is from its September ice towards its March ice (the south the other
 * way), so the ice grows and shrinks with the date.
 */
export const SEA_ICE = /* glsl */ `
  uniform sampler2D seaIceTodayMost;
  uniform sampler2D seaIceTodayYearRound;
  uniform sampler2D seaIcePastMost;
  uniform sampler2D seaIcePastYearRound;
  uniform float seaIceMix;
  uniform float seaIceActive;
  uniform float seaIceSeason;
  uniform vec2 seaIceGrid;

  // Sea ice over a colour, where \`sea\` (0 to 1) is how much of the point is sea.
  vec3 seaIceOver(vec3 color, vec2 uv, float sea) {
    if (seaIceActive < 0.5) return color;
    vec2 at = (uv * (seaIceGrid - 1.0) + 0.5) / seaIceGrid;
    float most = mix(texture2D(seaIceTodayMost, at).r, texture2D(seaIcePastMost, at).r, seaIceMix) * 255.0 / 250.0;
    float lasting = mix(texture2D(seaIceTodayYearRound, at).r, texture2D(seaIcePastYearRound, at).r, seaIceMix) * 255.0 / 250.0;
    float cover = max(0.45 * smoothstep(0.15, 0.4, most), 0.92 * smoothstep(0.15, 0.4, lasting));
    if (seaIceSeason >= 0.0) {
      // The north's March is the south's September: the hemispheres swing opposite ways.
      float winter = uv.y > 0.5 ? seaIceSeason : 1.0 - seaIceSeason;
      cover = 0.92 * smoothstep(0.15, 0.4, mix(lasting, most, winter));
    }
    return mix(color, srgb(vec3(0.92, 0.95, 0.99)), sea * cover);
  }
`;
