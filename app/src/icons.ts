/**
 * bob-ai Icon Vocabulary
 *
 * Rule: No boring icons. Every icon should feel like it was picked by
 * someone with personality. Cute, uncommon, metaphorical.
 *
 * Uses Phosphor Icons (light weight for that invisible-native feel).
 * Import from here — never use Phosphor directly in components.
 */

// ── Navigation & App ──────────────────────────────────
export { PhCookie as IconSettings } from '@phosphor-icons/vue' // settings = cookie (sweet config)
export { PhSparkle as IconNew } from '@phosphor-icons/vue' // new/add = sparkle
export { PhShootingStar as IconSend } from '@phosphor-icons/vue' // send = shooting star

// ── BoB candidates (pick one!) ────────────────────────
export { PhCat as IconBobCat } from '@phosphor-icons/vue'
export { PhBird as IconBobBird } from '@phosphor-icons/vue'
export { PhGhost as IconBobGhost } from '@phosphor-icons/vue'
export { PhRobot as IconBobRobot } from '@phosphor-icons/vue'
export { PhAlien as IconBobAlien } from '@phosphor-icons/vue'
export { PhDog as IconBobDog } from '@phosphor-icons/vue'
export { PhBug as IconBobBug } from '@phosphor-icons/vue'
export { PhFish as IconBobFish } from '@phosphor-icons/vue'
export { PhSmileyWink as IconBobWink } from '@phosphor-icons/vue'
export { PhDiamond as IconBobDiamond } from '@phosphor-icons/vue'

// Current pick (change this to swap globally)
export { PhGhost as IconBob } from '@phosphor-icons/vue'

// ── Identities ────────────────────────────────────────
export { PhSmiley as IconUser } from '@phosphor-icons/vue' // user = smiley
export { PhPawPrint as IconTeam } from '@phosphor-icons/vue' // team = paw print (pack)

// ── Agent Roles (reusing cute icons!) ─────────────────
export { PhDog as IconLead } from '@phosphor-icons/vue' // team lead = dog (loyal coordinator)
export { PhButterfly as IconUI } from '@phosphor-icons/vue' // UI dev = butterfly (makes pretty things)
export { PhBug as IconBackend } from '@phosphor-icons/vue' // backend = bug (lives in code)
export { PhAlien as IconResearch } from '@phosphor-icons/vue' // research = alien (probing the unknown)
export { PhBird as IconWriter } from '@phosphor-icons/vue' // writer = bird (sings beautiful prose)
export { PhFish as IconData } from '@phosphor-icons/vue' // data/streaming = fish (flows)
export { PhSmileyWink as IconTip } from '@phosphor-icons/vue' // tips/suggestions = wink
export { PhDiamond as IconQuality } from '@phosphor-icons/vue' // quality/review = diamond
export { PhRobot as IconAuto } from '@phosphor-icons/vue' // automation = robot
export { PhCat as IconDebug } from '@phosphor-icons/vue' // debug = cat (curious, finds things)

// ── Status ────────────────────────────────────────────
export { PhCarrot as IconSuccess } from '@phosphor-icons/vue' // success/done = carrot ✓
export { PhFlower as IconWorking } from '@phosphor-icons/vue' // working/active = flower (growing)
export { PhSkull as IconError } from '@phosphor-icons/vue' // error = skull
export { PhMoonStars as IconIdle } from '@phosphor-icons/vue' // idle = moon (sleeping)
export { PhPause as IconPaused } from '@phosphor-icons/vue' // paused = pause

// ── Actions ───────────────────────────────────────────
export { PhCat as IconDelete } from '@phosphor-icons/vue' // delete = cat (in red context)
export { PhFlowerLotus as IconCustomize } from '@phosphor-icons/vue' // customize = lotus
export { PhRocket as IconCreate } from '@phosphor-icons/vue' // create = rocket
export { PhEye as IconView } from '@phosphor-icons/vue' // view = eye
export { PhMagicWand as IconNewTeam } from '@phosphor-icons/vue' // new team = magic wand (conjure a team)
export { PhLightning as IconNewTeamAlt1 } from '@phosphor-icons/vue' // alt: lightning (spark a team)
export { PhPlanet as IconNewTeamAlt2 } from '@phosphor-icons/vue' // alt: planet (new world)
export { PhCompass as IconNewTeamAlt3 } from '@phosphor-icons/vue' // alt: compass (new direction)

// ── Content ───────────────────────────────────────────
export { PhLeaf as IconFile } from '@phosphor-icons/vue' // file = leaf
export { PhBracketsCurly as IconCode } from '@phosphor-icons/vue' // code = brackets
export { PhChatCircle as IconChat } from '@phosphor-icons/vue' // chat = chat circle
export { PhHeartbeat as IconActivity } from '@phosphor-icons/vue' // activity = heartbeat

// ── Timeline Events ───────────────────────────────────
export { PhLightning as IconTool } from '@phosphor-icons/vue' // tool invoke = lightning (zap!)
export { PhBinoculars as IconSearch } from '@phosphor-icons/vue' // web search = binoculars (scouting)
export { PhSpider as IconScrape } from '@phosphor-icons/vue' // web scrape = spider (crawling the web)
export { PhCrown as IconMilestone } from '@phosphor-icons/vue' // milestone = crown (achievement royalty)
export { PhArrowRight as IconDelegate } from '@phosphor-icons/vue' // delegation = arrow (handoff)
export { PhPencilSimple as IconDiff } from '@phosphor-icons/vue' // code changes = pencil (writing code)

/**
 * Default icon weight for the entire app.
 * "light" = thinnest strokes, most invisible feel.
 * Can also use "thin" for even more minimal.
 */
export const ICON_WEIGHT = 'light' as const
export const ICON_SIZE = 18
export const ICON_SIZE_SM = 14
export const ICON_SIZE_LG = 22
