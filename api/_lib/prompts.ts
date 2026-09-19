export interface Prompt {
  day: number;
  type: 'photo' | 'reflection';
  /** Short line for the notification title area and the day chip. */
  title: string;
  /** The invitation itself, shown above the capture button. */
  text: string;
}

export const PROMPTS: Prompt[] = [
  { day: 1, type: 'reflection', title: 'What came home with you',
    text: "You're home. In a sentence or two — what came back with you that you didn't pack?" },
  { day: 2, type: 'photo', title: 'Where you begin',
    text: 'Your altar, your corner, the place you sit. Show us where you begin.' },
  { day: 3, type: 'photo', title: 'Something green',
    text: 'Something green and growing near you today. A plant, a tree, a weed in the pavement.' },
  { day: 4, type: 'reflection', title: 'A line that stayed',
    text: 'One line from a teacher that has stayed with you. Write it as you remember it — imperfect is fine.' },
  { day: 5, type: 'photo', title: 'The sky now',
    text: 'The sky, right now, from wherever you are standing.' },
  { day: 6, type: 'photo', title: 'Your hands today',
    text: 'Your hands today — what did they do, what did they hold?' },
  { day: 7, type: 'reflection', title: 'How your morning went',
    text: 'How did your morning go? The true version, not the tidy one.' },
  { day: 8, type: 'photo', title: 'A flame you lit',
    text: 'A flame you lit today — a diya, a candle, a stove — or any light in your house you love.' },
  { day: 9, type: 'reflection', title: 'One gratitude',
    text: 'One gratitude. Small is welcome. Small is often truer.' },
  { day: 10, type: 'photo', title: 'Water',
    text: 'Water, wherever you find it. A river, a tap, a glass, the sea, the rain.' },
  { day: 11, type: 'reflection', title: 'Where the divine was',
    text: 'Where did you feel the divine today? It is allowed to be somewhere completely ordinary.' },
  { day: 12, type: 'photo', title: 'A moment of peace',
    text: 'A photo of something that brought you peace in the last hour.' },
  { day: 13, type: 'photo', title: 'A threshold',
    text: 'A doorway or threshold you passed through today.' },
  { day: 14, type: 'reflection', title: 'Set it down',
    text: "What are you carrying from the yatra that has started to feel heavy? You can set it down here." },
  { day: 15, type: 'photo', title: 'Halfway',
    text: 'Halfway. A photo of your feet, wherever they are standing right now.' },
  { day: 16, type: 'photo', title: 'Food and offering',
    text: 'Food you made, shared, or were given today.' },
  { day: 17, type: 'reflection', title: 'Someone from the group',
    text: 'Who from the yatra have you thought of this week, and what brought them to mind?' },
  { day: 18, type: 'photo', title: 'A colour found you',
    text: 'A colour that found you today. Follow it and photograph it.' },
  { day: 19, type: 'reflection', title: 'A moment of stillness',
    text: 'A moment of stillness you managed to catch today — how long was it, and what was in it?' },
  { day: 20, type: 'photo', title: 'Something old',
    text: 'Something old in your house that carries a story.' },
  { day: 21, type: 'photo', title: 'Your window',
    text: 'The view from a window you look out of often.' },
  { day: 22, type: 'reflection', title: 'What has changed',
    text: 'What has changed at home since you returned? Even something very small counts.' },
  { day: 23, type: 'photo', title: 'Hands that served',
    text: 'Hands that served today — yours, or someone else’s that you noticed.' },
  { day: 24, type: 'reflection', title: 'Words you keep',
    text: 'A prayer, a mantra, or a sentence you say quietly to yourself. Share one.' },
  { day: 25, type: 'photo', title: 'Almost missed',
    text: 'Something you almost walked past today, and then noticed.' },
  { day: 26, type: 'photo', title: 'Evening light',
    text: 'Evening light, wherever you are when it arrives.' },
  { day: 27, type: 'reflection', title: 'Past day thirty',
    text: 'What do you want to keep doing after these thirty days are over?' },
  { day: 28, type: 'photo', title: 'A face you love',
    text: 'A face you love. Ask them first, and tell them it is for the yatra group.' },
  { day: 29, type: 'photo', title: 'Your altar again',
    text: 'Your altar again — the same frame as Day 2, if you can manage it. See what has shifted.' },
  { day: 30, type: 'reflection', title: 'Thirty drops',
    text: 'Thirty days of drops. Walk back through the whole gallery first, slowly. Then tell us: what did this month light up in you?' },
];

export function promptForDay(day: number): Prompt | null {
  return PROMPTS.find((prompt) => prompt.day === day) ?? null;
}
