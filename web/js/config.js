// Settings to check before running participants.

/** Researcher panel passcode. Change this before running sessions. */
export const RESEARCHER_PASSCODE = '2468';

/**
 * Testing tools: shows a "Restart" pill in the top-left corner that wipes the
 * session and jumps back to the title screen in one tap, with no passcode and
 * no confirmation.
 *
 * SET THIS TO false BEFORE RUNNING PARTICIPANTS. A participant who taps it
 * mid-session destroys their own data, and the button is not part of the
 * stimulus. The researcher panel's "Reset for next participant" (triple-tap the
 * top-right corner) does the same job safely for real sessions.
 */
export const TESTING_TOOLS = true;
