import type { AvatarConfig } from "./types";

// All parts share one face geometry. Colors are assigned to semantic shapes;
// no PNG color guessing, erased dark pixels, or per-hairstyle face transforms.
function color(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
function mix(hex: string, other: string, amount: number) {
  const channels = [1, 3, 5].map((i) => Math.round(
    parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + parseInt(other.slice(i, i + 2), 16) * amount,
  ).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}

export function avatarSvg(config: AvatarConfig): string {
  const build = config.bodyType ?? "regular";
  const bodyWidth = build === "slim" ? .82 : build === "broad" ? 1.08 : .95;
  const headWidth = build === "broad" ? 1.15 : build === "slim" ? 1.02 : 1.08;
  const female = config.gender === "female";
  const skin = color(config.skinTone, "#D4A574");
  const hair = color(config.hairColor, "#1A1412");
  const beard = color(config.beardColor, hair);
  const cloth = color(config.clothingColor, "#111111");
  const eye = color(config.eyeColor, "#4A2F1C");
  const skinShadow = mix(skin, "#3C201C", .28);
  const skinLight = mix(skin, "#FFF0DB", .24);
  const hairShadow = mix(hair, "#10121B", .28);
  const hairLight = mix(hair, "#DCE8FF", .32);
  const ink = "#252130";
  const brow = mix(hair, "#241B20", .55);
  const face = female
    ? "M173 171 Q173 123 256 122 Q339 123 339 171 L334 254 Q326 299 278 329 Q256 343 234 329 Q186 299 178 254Z"
    : "M170 172 Q170 122 256 122 Q342 122 342 172 L334 267 L310 307 L275 336 Q256 345 237 336 L202 307 L178 267Z";
  const hairPaths: Record<string, string> = {
    short: "M169 224 L154 177 Q148 140 171 116 L162 108 L191 103 Q227 69 278 83 L318 72 L307 96 Q357 111 352 164 L339 225 L328 169 L312 183 L307 152 Q282 175 260 181 L269 151 Q234 182 204 186 L215 160 L184 183Z",
    spiky: "M169 224 Q148 193 155 162 L137 170 L155 141 L143 132 Q166 133 183 111 L169 105 Q205 106 220 80 L220 100 Q248 88 261 57 L271 88 Q296 74 313 78 L302 99 Q332 92 349 104 L335 117 Q357 126 367 151 L348 143 Q358 184 338 225 L328 174 L309 190 L311 150 Q294 171 276 180 L280 144 Q253 178 225 191 L235 153 Q211 179 188 183 L178 208Z",
    undercut: "M169 222 L159 164 Q154 116 187 98 Q238 66 303 82 Q348 91 349 131 L332 157 L333 219 L321 175 L319 139 Q272 170 191 145 L184 178Z",
    "long-wavy": "M169 241 Q143 187 162 133 Q174 81 234 86 Q253 75 271 88 Q334 78 354 138 Q370 189 341 244 L330 179 Q297 174 272 139 L280 177 Q263 167 256 137 Q231 174 201 188 L212 164 L185 179Z",
    bob: "M170 246 Q143 222 147 173 Q145 89 230 85 Q256 71 284 89 Q363 98 364 183 Q367 223 340 252 L329 177 L309 191 L301 158 L279 187 L267 148 L244 190 L233 164 L204 188 L185 176Z",
    ponytail: "M170 229 Q148 182 163 136 Q182 82 245 86 Q302 68 338 114 Q362 153 341 228 L329 168 Q285 149 258 113 Q229 154 184 172Z",
  };
  const style = hairPaths[config.hairStyle] ? config.hairStyle : female ? "long-wavy" : "spiky";
  const long = female && style === "long-wavy";
  const back = !female ? "" : style === "ponytail"
    ? '<path d="M327 119 Q407 84 397 174 Q383 220 405 277 Q365 262 356 212 L332 164Z" fill="url(#hair)" stroke="'+hairShadow+'" stroke-width="3"/>'
    : `<path d="${long ? 'M160 165 Q135 222 150 271 Q117 312 140 354 Q115 385 141 427 L202 402 L218 231 L301 224 L317 408 L375 427 Q396 391 372 355 Q394 311 364 269 Q379 213 352 158Z' : 'M152 166 Q139 243 155 304 Q180 327 210 307 L220 204 L302 203 L311 310 Q344 326 360 301 Q378 242 358 165Z'}" fill="url(#hair)" stroke="${hairShadow}" stroke-width="3"/>`;
  const beardShape = config.beardStyle === "goatee"
    ? "M226 297 Q238 311 256 310 Q274 311 286 297 L282 323 Q257 347 230 323Z"
    : "M178 253 Q194 281 215 282 L228 299 Q256 316 284 299 L297 282 Q318 281 334 253 L332 280 L310 311 L276 338 Q256 348 236 338 L202 311 L180 280Z";
  const accent = mix(cloth, "#D9E9FF", .65);
  const outfit = config.clothing === "hoodie"
    ? `<path d="M205 350 Q167 323 149 361 L129 393 Q169 399 208 384 L239 409 L256 424 L273 409 L304 384 Q343 399 383 393 L363 361 Q345 323 307 350 L304 371 Q282 397 256 403 Q230 397 208 371Z" fill="url(#shirt)" stroke="${mix(cloth, '#060C18', .4)}" stroke-width="3"/>
       <path d="M167 365 Q185 352 203 367 M345 365 Q327 352 309 367 M211 391L213 447 M301 391L299 447" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
       <g fill="${accent}"><rect x="210" y="441" width="6" height="13" rx="2"/><rect x="296" y="441" width="6" height="13" rx="2"/></g>
       <path d="M203 469 L190 494 Q256 509 322 494 L309 469Z" fill="${mix(cloth, '#000000', .12)}" stroke="${mix(cloth, '#FFFFFF', .16)}" stroke-width="1.5"/>`
    : config.clothing === "jersey"
    ? `<path d="M202 356 L256 391 L310 356 L315 368 L256 408 L197 368Z" fill="${mix(cloth, '#111726', .65)}" stroke="${accent}" stroke-width="2"/>
       <path d="M65 415L174 379L183 394L75 435Z M447 415L338 379L329 394L437 435Z" fill="${accent}"/>
       <path d="M96 446 L178 422 L256 459 L334 422 L416 446 L334 438 L256 481 L178 438Z" fill="${mix(cloth, '#FFFFFF', .2)}"/>
       <path d="M304 408L323 416L320 435L304 445L288 435L285 416Z" fill="${mix(cloth, '#101526', .6)}" stroke="${accent}" stroke-width="1.5"/>
       <path d="M296 420L304 427L312 420L304 436Z" fill="${accent}"/>`
    : "";
  const strands = Array.from({ length: 13 }, (_, i) => {
    const x = 172 + i * 12;
    return `<path d="M${x} ${140 - Math.sin(i / 12 * Math.PI) * 42} Q${x + 13} ${113 - Math.sin(i / 12 * Math.PI) * 22} ${female ? 253 : 284} ${female ? 98 : 90}"/>`;
  }).join("");
  const facialHair = female || config.beardStyle === "none" ? "" : `<g clip-path="url(#face-clip)" fill="${beard}">
    <path d="${beardShape}" opacity="${config.beardStyle === 'stubble' ? '.28' : '1'}"/>
    ${config.beardStyle === 'stubble' ? '' : '<path d="M225 287 Q239 276 250 282 L256 286 L262 282 Q273 276 287 287 L293 295 Q273 289 260 291 L256 290 L252 291 Q239 289 219 295Z"/>'}
    <g stroke="${mix(beard, '#FFF0DB', .22)}" stroke-width="1.1" opacity=".5">${Array.from({length: 21}, (_, i) => {const x = 228 + i * 2.8; const y = 321 + 7 * Math.sin(i / 20 * Math.PI); return `<path d="M${x} ${y}l1 5"/>`;}).join('')}</g>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="skin" cx=".38" cy=".3" r=".8"><stop stop-color="${skinLight}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="${skinShadow}"/></radialGradient>
    <radialGradient id="blush"><stop stop-color="${mix(skin, '#DE788A', .4)}" stop-opacity=".4"/><stop offset="1" stop-color="${skin}" stop-opacity="0"/></radialGradient>
    <linearGradient id="rim"><stop stop-color="${skinLight}" stop-opacity=".7"/><stop offset="1" stop-color="${skinLight}" stop-opacity="0"/></linearGradient>
    <linearGradient id="hair" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="${hairLight}"/><stop offset=".45" stop-color="${hair}"/><stop offset="1" stop-color="${hairShadow}"/></linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${mix(cloth, '#FFFFFF', .12)}"/><stop offset=".55" stop-color="${cloth}"/><stop offset="1" stop-color="${mix(cloth, '#080F20', .25)}"/></linearGradient>
    <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${mix(eye, '#151422', .5)}"/><stop offset=".6" stop-color="${eye}"/><stop offset="1" stop-color="${mix(eye, '#F4C97D', .55)}"/></linearGradient>
    <clipPath id="eyes"><path d="M186 230 Q211 ${female ? 203 : 209} 239 231 Q225 260 200 248Z M273 231 Q301 ${female ? 203 : 209} 326 230 L312 248 Q287 260 273 231Z"/></clipPath>
    <clipPath id="hair-clip"><path d="${hairPaths[style]}"/></clipPath>
    <clipPath id="face-clip"><path d="${face}"/></clipPath>
  </defs>
  <g transform="translate(256 220) scale(${headWidth} .98) translate(-256 -220)">${back}</g>
  <g transform="translate(256 0) scale(${bodyWidth} 1) translate(-256 0)">
  <path d="M209 298 L207 358 L169 379 Q256 432 343 379 L305 358 L303 298Z" fill="url(#skin)"/>
  <path d="M210 306 Q256 359 303 306 L301 333 Q262 374 211 339Z" fill="${skinShadow}" opacity=".65"/>
  <path d="M207 355 L173 369 Q96 384 65 408 Q43 431 28 512 H484 Q469 431 447 408 Q416 384 339 369 L305 355 Q302 391 256 397 Q210 391 207 355Z" fill="url(#shirt)" stroke="${mix(cloth, '#FFFFFF', .18)}" stroke-width="2"/>
  <path d="M204 358 Q210 401 256 405 Q302 401 308 358" fill="none" stroke="${mix(cloth, '#000000', .4)}" stroke-width="10"/>
  <path d="M202 359 Q211 398 256 400 Q301 398 310 359 M110 398 L88 446 L99 512 M402 398 L424 446 L413 512" fill="none" stroke="${mix(cloth, '#FFFFFF', .2)}" stroke-width="2"/>
  <path d="M73 425 L164 393 L146 408 L64 440Z M439 425 L348 393 L366 408 L448 440Z" fill="${mix(cloth, '#FFFFFF', .27)}"/>
  <path d="M121 475 L157 428 L143 512 M391 475 L355 428 L369 512" fill="${mix(cloth, '#000000', .2)}" opacity=".6"/>
  ${outfit}
  </g>
  <g transform="translate(256 220) scale(${headWidth} .98) translate(-256 -220)">
  <g fill="url(#skin)" stroke="${skinShadow}" stroke-width="2"><path d="M178 212 Q151 192 155 227 Q158 259 181 266Z"/><path d="M334 212 Q361 192 357 227 Q354 259 331 266Z"/></g>
  <path d="M168 216 Q159 211 163 234 L175 246 M344 216 Q353 211 349 234 L337 246" fill="none" stroke="${skinShadow}" stroke-width="4" stroke-linecap="round"/>
  <path d="${face}" fill="url(#skin)" stroke="${mix(skinShadow, ink, .35)}" stroke-width="2.2"/>
  <g clip-path="url(#face-clip)">
    <path d="M174 181 Q181 245 199 277 Q218 311 244 336 Q208 326 181 278Z M338 181 Q331 245 313 277 Q294 311 268 336 Q304 326 331 278Z" fill="${skinShadow}" opacity=".25"/>
    <ellipse cx="204" cy="266" rx="27" ry="18" fill="url(#blush)"/><ellipse cx="308" cy="266" rx="27" ry="18" fill="url(#blush)"/>
    <path d="M180 234 Q183 280 213 308" fill="none" stroke="url(#rim)" stroke-width="4" stroke-linecap="round"/>
    <path d="M193 215 Q213 204 234 219 M278 219 Q299 204 319 215" fill="none" stroke="${skinShadow}" stroke-width="2" opacity=".35"/>
  </g>
  <path d="M187 210 Q208 202 235 212 L235 215 Q209 209 188 214Z M325 210 Q304 202 277 212 L277 215 Q303 209 324 214Z" fill="${brow}"/>
  <g clip-path="url(#eyes)">
    <path d="M180 215H332V255H180Z" fill="#FFFAF5"/>
    <g fill="url(#iris)" stroke="${ink}" stroke-width="1.5"><ellipse cx="214" cy="234" rx="${female ? 14.5 : 13}" ry="18"/><ellipse cx="298" cy="234" rx="${female ? 14.5 : 13}" ry="18"/></g>
    <g fill="${ink}"><ellipse cx="214" cy="230" rx="4.5" ry="10"/><ellipse cx="298" cy="230" rx="4.5" ry="10"/></g>
    <path d="M180 217H332V228Q256 221 180 228Z" fill="${ink}" opacity=".17"/>
    <g fill="#FFFFFF"><ellipse cx="209" cy="225" rx="4" ry="5"/><ellipse cx="293" cy="225" rx="4" ry="5"/><circle cx="220" cy="240" r="2"/><circle cx="304" cy="240" r="2"/></g>
  </g>
  <g fill="none" stroke="${ink}" stroke-linecap="round">
    <path d="M186 230 Q211 ${female ? 203 : 209} 239 231 M273 231 Q301 ${female ? 203 : 209} 326 230" stroke-width="${female ? 4.5 : 3.5}"/>
    <path d="M200 248 Q220 257 234 243 M278 243 Q292 257 312 248" stroke-width="1.2"/>
    ${female ? '<path d="M189 229l-7-7 M193 225l-4-7 M323 229l7-7 M319 225l4-7" stroke-width="2.4"/>' : ''}
  </g>
  <path d="M255 242 L250 262 L257 266" fill="none" stroke="${skinShadow}" stroke-width="2" stroke-linecap="round"/>
  <path d="M257 254l3 7" stroke="${skinLight}" stroke-width="2.5" stroke-linecap="round"/>
  ${facialHair}
  ${female
    ? `<path d="M235 292 Q247 286 256 289 Q268 286 279 291 Q256 306 235 292Z" fill="${mix(skin, '#BE6874', .42)}"/><path d="M237 292 Q258 296 278 291" fill="none" stroke="${mix(skinShadow, '#713846', .25)}" stroke-width="1.3"/><path d="M248 300Q257 302 267 298" fill="none" stroke="${skinLight}" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="M238 291 Q254 295 275 289" fill="none" stroke="${mix(skinShadow, '#623D40', .3)}" stroke-width="1.8" stroke-linecap="round"/><path d="M248 300Q257 303 266 299" fill="none" stroke="${skinLight}" stroke-width="1.6" stroke-linecap="round"/>`}
  <path d="${hairPaths[style]}" fill="url(#hair)" stroke="${mix(hairShadow, ink, .45)}" stroke-width="2.5" stroke-linejoin="round"/>
  <g clip-path="url(#hair-clip)">
    <g fill="none" stroke="${mix(hair, '#C7D8F3', .25)}" stroke-width="1" opacity=".6">${strands}</g>
    <g fill="${hairLight}" opacity=".55">
      ${female ? '<path d="M167 151 Q182 105 238 100 Q201 115 183 150 L175 163Z M272 101 Q323 104 344 152 L332 146 Q316 119 286 114Z"/>' : '<path d="M172 147 Q204 112 252 105 L236 118 Q201 132 181 157Z M215 137 Q258 98 296 101 L278 113 Q246 125 232 146Z M281 131 Q318 116 339 139 L327 138 L306 137 L291 147Z"/>'}
    </g>
    <g fill="none" stroke="${hairShadow}" stroke-width="2" opacity=".8">
      ${female ? '<path d="M179 178 Q185 127 244 106 M204 181 Q238 155 256 119 M276 119 Q313 143 334 177"/>' : '<path d="M178 174 Q193 142 240 121 M213 176 Q241 137 274 117 M266 176 Q292 143 305 122 M311 180 Q324 155 330 137"/>'}
    </g>
    <path d="${female ? 'M175 137Q190 107 223 101 M289 103Q320 114 334 136' : 'M172 137Q198 112 221 107 M247 103L270 91 M310 113L333 123'}" fill="none" stroke="${mix(hair, '#EDF2FF', .45)}" stroke-width="1.7" stroke-linecap="round"/>
  </g>
  ${long ? `<g fill="url(#hair)" stroke="${hairShadow}" stroke-width="2"><path d="M167 175 Q142 233 165 277 Q143 307 163 339 Q145 372 173 415 L204 431 Q179 388 198 355 Q178 320 192 290 L181 233Z"/><path d="M345 175 Q370 233 347 277 Q369 307 349 339 Q367 372 339 415 L308 431 Q333 388 314 355 Q334 320 320 290 L331 233Z"/></g><g fill="none" stroke="${hairLight}" stroke-width="3" opacity=".55"><path d="M165 227 Q181 269 165 305 Q189 339 173 374 L188 409"/><path d="M347 227 Q331 269 347 305 Q323 339 339 374 L324 409"/></g>` : ''}
  </g>
  </svg>`;
}
