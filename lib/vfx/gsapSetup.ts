import { gsap } from 'gsap'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { CustomWiggle } from 'gsap/CustomWiggle'

/**
 * Registers the (now free) GSAP club plugins we use for richer combat VFX:
 * - Physics2DPlugin: real velocity/gravity particle motion (embers, debris, blood).
 * - CustomWiggle/CustomEase: organic jitter eases (fire flicker, lightning).
 * Side-effect module — imported once by the effects layer.
 */
gsap.registerPlugin(Physics2DPlugin, CustomEase, CustomWiggle)

export const GSAP_PLUGINS_READY = true
