// Dynamic AI Uplink gateway calling Gemini, SambaNova, Groq, and Cerebras
const getApiKey = () => {
    return import.meta.env.VITE_GEMINI_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.GEMINI_API_KEY : "");
};

const getSambaNovaApiKey = () => {
    return import.meta.env.VITE_SAMBANOVA_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.SAMBANOVA_API_KEY : "");
};

const getGroqApiKey = () => {
    return import.meta.env.VITE_GROQ_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.GROQ_API_KEY : "");
};

const getCerebrasApiKey = () => {
    return import.meta.env.VITE_CEREBRAS_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.CEREBRAS_API_KEY : "");
};

// SambaNova Client Helper
async function callSambaNovaAPI(prompt) {
    const apiKey = getSambaNovaApiKey();
    if (!apiKey) throw new Error("No SambaNova API key configured");

    console.log(">> [API] Connecting to SambaNova API...");
    const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "Meta-Llama-3.3-70B-Instruct",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        throw new Error(`SambaNova HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    if (data.choices && data.choices.length > 0) {
        const rawText = data.choices[0].message.content;
        const cleanText = rawText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    }
    throw new Error("No content returned from SambaNova");
}

// Groq Client Helper
async function callGroqAPI(prompt) {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error("No Groq API key configured");

    console.log(">> [API] Connecting to Groq API...");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        throw new Error(`Groq HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    if (data.choices && data.choices.length > 0) {
        const rawText = data.choices[0].message.content;
        const cleanText = rawText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    }
    throw new Error("No content returned from Groq");
}

// Cerebras Client Helper
async function callCerebrasAPI(prompt) {
    const apiKey = getCerebrasApiKey();
    if (!apiKey) throw new Error("No Cerebras API key configured");

    console.log(">> [API] Connecting to Cerebras API...");
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-oss-120b",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        throw new Error(`Cerebras HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    if (data.choices && data.choices.length > 0) {
        const rawText = data.choices[0].message.content;
        const cleanText = rawText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    }
    throw new Error("No content returned from Cerebras");
}

// Memory Management
export async function fetchMemory() {
    try {
        const response = await fetch('/api/memory');
        if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Response is not JSON");
        }
        return await response.json();
    } catch (e) {
        console.warn(">> [API] Memory server offline, loading from localStorage:", e.message);
        try {
            const localData = localStorage.getItem("admin_memory_history");
            return localData ? JSON.parse(localData) : [];
        } catch (localErr) {
            console.error(">> [API] LocalStorage read failed:", localErr.message);
            return [];
        }
    }
}

export async function saveMemory(floor, challenge, player_answer, admin_remark) {
    try {
        const response = await fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floor, challenge, player_answer, admin_remark })
        });
        if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
        }
    } catch (e) {
        console.warn(">> [API] Memory server save failed, saving to localStorage:", e.message);
    }

    try {
        const localData = localStorage.getItem("admin_memory_history");
        const history = localData ? JSON.parse(localData) : [];
        history.push({ floor, challenge, player_answer, admin_remark });
        if (history.length > 5) {
            history.shift();
        }
        localStorage.setItem("admin_memory_history", JSON.stringify(history));
    } catch (localErr) {
        console.error(">> [API] LocalStorage write failed:", localErr.message);
    }
}

// Handcrafted Offline Reference Riddles
const offlineRiddles = [
    { question: "I have keys but open no locks. I have space but no room. You can enter, but you cannot go outside. What am I?", hint: "Look down; you are likely using one now.", solution: "KEYBOARD" },
    { question: "What goes down but never goes up?", hint: "It falls from the storm clouds.", solution: "RAIN" },
    { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", hint: "A sound wave reflection.", solution: "ECHO" },
    { question: "The more of them you take, the more you leave behind. What are they?", hint: "Footmarks left on the climbing platform.", solution: "FOOTSTEPS" },
    { question: "What is full of holes but still holds water?", hint: "Porous absorption material.", solution: "SPONGE" },
    { question: "What has a head and a tail but no body?", hint: "A metallic currency coin.", solution: "COIN" },
    { question: "I am always hungry, I must be fed. The finger I touch will soon turn red. What am I?", hint: "Keep me away from water.", solution: "FIRE" },
    { question: "If you look at the face of my clock, you see 12. If you divide it by two, you get nothing. What am I?", hint: "Think about the shape of the digits.", solution: "8" },
    { question: "I have no beginning, end, or middle, and I'm present in every circular loop. What am I?", hint: "Zero or Ring.", solution: "RING" },
    { question: "I exist only when there is light, but direct light kills me. What am I?", hint: "Your companion on a sunny day.", solution: "SHADOW" },
    { question: "I can rush without feet, scream without a throat, and sweep without a broom. What am I?", hint: "Felt on your face on a windy day.", solution: "WIND" },
    { question: "I have a mouth but never speak, a bed but never sleep, and I run but never walk. What am I?", hint: "Flows towards the sea.", solution: "RIVER" },
    { question: "What has four fingers and a thumb, but is not alive?", hint: "Worn on your hands in winter.", solution: "GLOVE" },
    { question: "I am tall when I am young, and I am short when I am old. What am I?", hint: "Provides light by melting away.", solution: "CANDLE" },
    { question: "The person who makes it has no need of it. The person who buys it has no use for it. The person who uses it can neither see nor feel it. What is it?", hint: "Associated with burial.", solution: "COFFIN" },
    { question: "I have cities but no houses, forests but no trees, and water but no fish. What am I?", hint: "Navigation guide.", solution: "MAP" },
    { question: "If you speak my name, you break me. What am I?", hint: "The absolute absence of sound.", solution: "SILENCE" },
    { question: "The more of me there is, the less you see. What am I?", hint: "Opposite of light.", solution: "DARKNESS" },
    { question: "I have hands but cannot clap, and a face but cannot smile. What am I?", hint: "Keeps track of hours.", solution: "CLOCK" },
    { question: "What can travel around the world while staying in a single corner?", hint: "Placed on a mailing envelope.", solution: "STAMP" },
    { question: "What has a neck but no head, and a spout but no mouth?", hint: "Used to brew tea.", solution: "TEAPOT" },
    { question: "What begins with an E, ends with an E, but only contains a single letter?", hint: "Used for posting mail.", solution: "ENVELOPE" },
    { question: "Look at me and I look at you. If you blink, I blink too. What am I?", hint: "Reflective glass.", solution: "MIRROR" },
    { question: "What gets wetter the more it dries?", hint: "Used after taking a shower.", solution: "TOWEL" },
    { question: "If you have me, you want to share me. If you share me, you haven't got me. What am I?", hint: "Hidden information.", solution: "SECRET" },
    { question: "What can you break, even if you never pick it up or touch it?", hint: "A binding word of honor.", solution: "PROMISE" },
    { question: "What runs around the whole yard without moving?", hint: "Wood or metal barrier.", solution: "FENCE" },
    { question: "What is made of glass, lets you look through a wall, but keeps the wind out?", hint: "Found on walls.", solution: "WINDOW" },
    { question: "I am light as a feather, yet the strongest man cannot hold me for long. What am I?", hint: "Inhaled air.", solution: "BREATH" },
    { question: "I have a spine but no bones, leaves but no branches. What am I?", hint: "Read me to gain knowledge.", solution: "BOOK" },
    { question: "Take off my skin and I won't cry, but you will! What am I?", hint: "Crying vegetable.", solution: "ONION" }
];

const associations = [
    { q: "Day is to Sun as Night is to...", a: "MOON", h: "Earth's natural satellite." },
    { q: "Ice is to Cold as Fire is to...", a: "HOT", h: "High temperature." },
    { q: "Fish is to Water as Bird is to...", a: "AIR", h: "The atmosphere we breathe." },
    { q: "Page is to Book as Key is to...", a: "KEYBOARD", h: "Input device." },
    { q: "Glove is to Hand as Sock is to...", a: "FOOT", h: "Lower extremity." },
    { q: "Bark is to Dog as Meow is to...", a: "CAT", h: "Common feline pet." },
    { q: "Smile is to Happy as Frown is to...", a: "SAD", h: "Opposite of joyful." },
    { q: "Left is to West as Up is to...", a: "NORTH", h: "Compass direction pointing towards the pole star." },
    { q: "Water is to Liquid as Rock is to...", a: "SOLID", h: "State of matter." },
    { q: "Doctor is to Hospital as Teacher is to...", a: "SCHOOL", h: "Learning center." }
];

const homophones = [
    { q: "I sound like the color of the sky, but I am what the wind did. What am I?", a: "BLEW", h: "Past tense of blow." },
    { q: "I sound like a dark period of 12 hours, but I am a warrior in shining armor. What am I?", a: "KNIGHT", h: "Medieval soldier." },
    { q: "I sound like the number after seven, but I am what you did to your dinner. What am I?", a: "ATE", h: "Consumed food." },
    { q: "I sound like a tree branch, but I am a gesture of respect using your head. What am I?", a: "BOW", h: "Inclining the head." },
    { q: "I sound like the word for 'nothing', but I am a circular rope tie. What am I?", a: "KNOT", h: "Fastened cord." },
    { q: "I sound like a flower, but I am the powder used to bake bread. What am I?", a: "FLOUR", h: "Baking ingredient." },
    { q: "I sound like a ocean, but I am the action of looking with your eyes. What am I?", a: "SEE", h: "Perceive with sight." }
];

const scrambles = [
    { q: "Rearrange the letters of 'LISTEN' to make a word that means the absence of sound.", a: "SILENT", h: "Complete quietness." },
    { q: "Rearrange the letters of 'EARTH' to make a word that beats inside your chest.", a: "HEART", h: "Circulatory organ." },
    { q: "Rearrange the letters of 'RACE' to mean 'to look after or worry about someone'.", a: "CARE", h: "Opposite of neglect." },
    { q: "Rearrange the letters of 'MELON' to get a yellow citrus fruit.", a: "LEMON", h: "Very sour fruit." },
    { q: "Rearrange the letters of 'PEAR' to get a word meaning to harvest or gather.", a: "REAP", h: "You sow, and then you..." },
    { q: "Rearrange the letters of 'SWAP' to get a stinging yellow and black insect.", a: "WASP", h: "Flying pest with a stinger." },
    { q: "Rearrange the letters of 'ACT' to get a furry domestic pet.", a: "CAT", h: "Feline." },
    { q: "Rearrange the letters of 'BREAD' to get the hair growing on a man's chin.", a: "BEARD", h: "Facial hair." }
];

const trivia = [
    { q: "What is the only planet in our solar system known to harbor liquid water oceans on its surface and support life?", a: "EARTH", h: "Our home planet." },
    { q: "What is the closest star to our planet Earth?", a: "SUN", h: "The yellow dwarf star at the center of our system." },
    { q: "Which chemical element has the symbol 'O' and is essential for human respiration?", a: "OXYGEN", h: "Atomic number 8." },
    { q: "What gaseous substance do trees produce that humans need to breathe?", a: "OXYGEN", h: "Plants release this gas during photosynthesis." },
    { q: "What is the common name for frozen solid water?", a: "ICE", h: "Found in your freezer." },
    { q: "What basic force keeps our feet on the ground and governs the orbits of the planets?", a: "GRAVITY", h: "What goes up must come down." }
];

// Helper to determine zone info based on floor (1-100)
export function getZoneInfo(floor) {
    if (floor <= 10) return { name: "THE NEBULA GATEWAY", r: 0, g: 229, b: 255, style: "cyber-cyan" };
    if (floor <= 20) return { name: "TWILIGHT ZONE", r: 189, g: 0, b: 255, style: "spectral-violet" };
    if (floor <= 30) return { name: "STORM CRUCIBLE", r: 255, g: 60, b: 0, style: "volcanic-red" };
    if (floor <= 40) return { name: "TEMPORAL MIRAGE", r: 255, g: 170, b: 0, style: "amber-glow" };
    if (floor <= 50) return { name: "THE COGNITIVE LABYRINTH", r: 0, g: 255, b: 102, style: "green-glow" };
    if (floor <= 60) return { name: "DEEP OBSIDIAN", r: 0, g: 102, b: 255, style: "deep-blue" };
    if (floor <= 70) return { name: "GRAVITY WELL", r: 220, g: 220, b: 0, style: "yellow-momentum" };
    if (floor <= 80) return { name: "COSMIC SPECTRUM", r: 255, g: 0, b: 128, style: "quantum-pink" };
    if (floor <= 90) return { name: "SINGULARITY CORE", r: 240, g: 240, b: 240, style: "silver-glitch" };
    return { name: "INFINITE ASCENDANCY", r: 255, g: 215, b: 0, style: "gold-overlord" };
}

// Procedural puzzle generator for dynamic fallback coverage across 100 floors
// Generates fun riddles, quizzes, and word puzzles, strictly omitting hex, binary, math sequences, or logic gates.
function generateProceduralChallenge(floor) {
    const type = floor % 5;
    
    switch (type) {
        case 0: {
            // Word Association Quiz
            const idx = (floor * 3 + 7) % associations.length;
            const item = associations[idx];
            return {
                challenge: item.q,
                administrator_intro: `Floor ${floor} cognitive association sync. Complete the conceptual link.`,
                hint: item.h,
                solution: item.a
            };
        }
        case 1: {
            // Homophone Riddle
            const idx = (floor * 5 + 11) % homophones.length;
            const item = homophones[idx];
            return {
                challenge: item.q,
                administrator_intro: `Floor ${floor} acoustic decryption portal. Identify the homophone match.`,
                hint: item.h,
                solution: item.a
            };
        }
        case 2: {
            // Word Scrambles
            const idx = (floor * 11 + 17) % scrambles.length;
            const item = scrambles[idx];
            return {
                challenge: item.q,
                administrator_intro: `Floor ${floor} letter reconstruction algorithm. Reassemble the character stack.`,
                hint: item.h,
                solution: item.a
            };
        }
        case 3: {
            // Trivia Quiz
            const idx = (floor * 13 + 19) % trivia.length;
            const item = trivia[idx];
            return {
                challenge: item.q,
                administrator_intro: `Floor ${floor} system archives core intelligence check.`,
                hint: item.h,
                solution: item.a
            };
        }
        default: {
            // Classic offline riddles (expanded to be much larger)
            const idx = (floor * 17 + 23) % offlineRiddles.length;
            const item = offlineRiddles[idx];
            return {
                challenge: item.question,
                administrator_intro: `Floor ${floor} mainframe gateway poses a timeless riddle.`,
                hint: item.hint,
                solution: item.solution
            };
        }
    }
}

export async function generateChallenge(floor, className) {
    const zone = getZoneInfo(floor);
    const memory = await fetchMemory();
    
    let memoryContext = "";
    if (memory && memory.length > 0) {
        memoryContext = "\nPREVIOUS CONVERSATION MEMORY (Use this to casually reference past interactions if relevant, but do not dwell on it):\n";
        memory.forEach(m => {
            memoryContext += `- Floor ${m.floor}: Asked "${m.challenge}". Player answered: "${m.player_answer}". You replied: "${m.admin_remark}"\n`;
        });
    }

    const type = floor % 5;
    let typeDescription = "";
    switch (type) {
        case 0:
            typeDescription = "a 'Word Association' quiz (e.g. 'Day is to Sun as Night is to...'). Provide the missing word.";
            break;
        case 1:
            typeDescription = "a 'Homophone Riddle' (e.g. 'I sound like the color of the sky, but I am what the wind did. What am I?'). Identify the homophone.";
            break;
        case 2:
            typeDescription = "a 'Word Scramble / Anagram' puzzle (e.g. 'Rearrange the letters of LISTEN to make a word that means the absence of sound'). Give the scrambled letters and clue.";
            break;
        case 3:
            typeDescription = "a simple 'General Knowledge Trivia' question (e.g. 'What is the closest star to our planet Earth?').";
            break;
        default:
            typeDescription = "a classic 'Riddle' (e.g. 'What gets wetter the more it dries?').";
            break;
    }
    
    const prompt = `You are a dark, ominous cybernetic deity called "The Administrator".
Generate a themed puzzle for floor level ${floor} of your neon tower. 
The player's active class is: "${className}".
The current zone is "${zone.name}".${memoryContext}

The required question type for this floor is: ${typeDescription}

CRITICAL RULES for question generation:
1. Make the question fun, riddle-like or quiz-like.
2. ABSOLUTELY NO programming, computer science, hexadecimal numbers, binary numbers, logic gates, mathematical series, complex equations, or cryptographic ciphers (like matrix shifts).
3. The question must be unique and specific to floor ${floor}.
4. Carefully inspect the PREVIOUS CONVERSATION MEMORY (if any). You MUST NOT repeat any of the questions, answers, themes, or formats previously asked.
5. The answer/solution must be a single, definitive, short English word or number in UPPER CASE, with no spaces.
6. The question and hint must be easy to read and understand, using clean and simple English. Keep the Administrator's speech in the intro sarcastic and dark, but accessible.

You MUST return a JSON object with this exact schema:
{
  "challenge": "A clear, descriptive puzzle question of the requested type",
  "administrator_intro": "Sarcastic, imposing greeting addressing their class or floor. Keep the vocabulary simple and avoid heavy jargon.",
  "hint": "A subtle clue detailing spelling, length, or logical method"
}

Ensure the puzzle has a single, definitive, short English word or number code solution (UPPER CASE).
Return ONLY the raw JSON block without markdown formatting or code blocks.`;

    // 1. Try Gemini
    const geminiApiKey = getApiKey();
    if (geminiApiKey) {
        try {
            console.log(`>> [API] Requesting Floor ${floor} challenge from Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) throw new Error(`Gemini status code: ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            if (data.candidates && data.candidates.length > 0) {
                const rawText = data.candidates[0].content.parts[0].text;
                const cleanText = rawText.replace(/```json|```/g, "").trim();
                const parsed = JSON.parse(cleanText);
                if (parsed.challenge && parsed.administrator_intro) {
                    return parsed;
                }
            }
            throw new Error("Malformed JSON schema returned");
        } catch (e) {
            console.warn(`>> [API] Gemini Challenge failed on Floor ${floor}: "${e.message}". Trying SambaNova.`);
        }
    }

    // 2. Try SambaNova
    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            return await callSambaNovaAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] SambaNova Challenge failed on Floor ${floor}: "${e.message}". Trying Groq.`);
        }
    }

    // 3. Try Groq
    const groqKey = getGroqApiKey();
    if (groqKey) {
        try {
            return await callGroqAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] Groq Challenge failed on Floor ${floor}: "${e.message}". Trying Cerebras.`);
        }
    }

    // 4. Try Cerebras
    const cerebrasKey = getCerebrasApiKey();
    if (cerebrasKey) {
        try {
            return await callCerebrasAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] Cerebras Challenge failed on Floor ${floor}: "${e.message}". Falling back to procedural.`);
        }
    }

    // 5. Procedural Fallback
    console.warn(`>> [API] No AI providers succeeded/available. Using fallback procedural challenge.`);
    return generateProceduralChallenge(floor);
}

export async function checkAnswer(floor, question, userAnswer) {
    const procedural = generateProceduralChallenge(floor);
    const memory = await fetchMemory();
    
    let memoryContext = "";
    if (memory && memory.length > 0) {
        memoryContext = "\nPREVIOUS CONVERSATION MEMORY:\n";
        memory.forEach(m => {
            memoryContext += `- Floor ${m.floor}: Asked "${m.challenge}". Player answered: "${m.player_answer}". You replied: "${m.admin_remark}"\n`;
        });
    }
    
    const prompt = `You are "The Administrator".
Evaluate if the user's answer: "${userAnswer}" is SEMANTICALLY correct for this puzzle question: "${question}".${memoryContext}

Rules for semantic evaluation:
- Ignore capitalization, trailing/leading whitespace, and punctuation.
- Ignore simple English articles like "a", "the", "an", "to" (e.g. if the solution is "KEYBOARD", then "a keyboard" or "the keyboard" is CORRECT).
- Allow minor spelling typos if the word is clearly recognizable.

Return a JSON object matching this exact schema:
{
  "correct": true or false,
  "administrator_remarks": "In-character dramatic line. If correct, slightly impressed but mocking. If incorrect, highly sarcastic and taunting. IMPORTANT: Keep the language simple and clear, avoid heavy cyber-jargon or complex words.",
  "solution": "The definitive target answer in UPPER CASE"
}
Return ONLY the raw JSON block without markdown formatting or code blocks.`;

    // 1. Try Gemini
    const geminiApiKey = getApiKey();
    if (geminiApiKey) {
        try {
            console.log(`>> [API] Checking answer semantically via Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) throw new Error(`Gemini status code: ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            if (data.candidates && data.candidates.length > 0) {
                const rawText = data.candidates[0].content.parts[0].text;
                const cleanText = rawText.replace(/```json|```/g, "").trim();
                const parsed = JSON.parse(cleanText);
                
                saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
                return parsed;
            }
            throw new Error("Malformed judge response");
        } catch (e) {
            console.warn(`>> [API] Gemini Semantic judge failed: "${e.message}". Trying SambaNova.`);
        }
    }

    // 2. Try SambaNova
    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            const parsed = await callSambaNovaAPI(prompt);
            saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
            return parsed;
        } catch (e) {
            console.warn(`>> [API] SambaNova Semantic judge failed: "${e.message}". Trying Groq.`);
        }
    }

    // 3. Try Groq
    const groqKey = getGroqApiKey();
    if (groqKey) {
        try {
            const parsed = await callGroqAPI(prompt);
            saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
            return parsed;
        } catch (e) {
            console.warn(`>> [API] Groq Semantic judge failed: "${e.message}". Trying Cerebras.`);
        }
    }

    // 4. Try Cerebras
    const cerebrasKey = getCerebrasApiKey();
    if (cerebrasKey) {
        try {
            const parsed = await callCerebrasAPI(prompt);
            saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
            return parsed;
        } catch (e) {
            console.warn(`>> [API] Cerebras Semantic judge failed: "${e.message}". Falling back to client exact match.`);
        }
    }

    // 5. Procedural Fallback
    console.warn(`>> [API] No AI providers succeeded/available for judge. Running client exact match.`);
    return runLocalExactMatch(floor, question, userAnswer, procedural.solution);
}

function runLocalExactMatch(floor, question, userAnswer, targetSolution) {
    const cleanUser = userAnswer.trim().toUpperCase().replace(/^(A|THE|AN)\s+/, "");
    const cleanSol = targetSolution.trim().toUpperCase();
    
    const isCorrect = cleanUser === cleanSol || cleanUser.includes(cleanSol) || cleanSol.includes(cleanUser);
    
    const fallbackRemark = isCorrect 
        ? "Hmph. Match detected in local system buffers. Don't let success blind you, Aspirant."
        : "Match rejected. Your input sequence is mathematically deficient.";
        
    saveMemory(floor, question, userAnswer, fallbackRemark);
    
    return {
        correct: isCorrect,
        administrator_remarks: fallbackRemark,
        solution: cleanSol
    };
}

export async function determineSpecializedClass(history) {
    const prompt = `You are conducting a "Class Promotion Ceremony" for a 100-floor tower game.
Analyze the player's chronological puzzle response logs:
${JSON.stringify(history)}

Based on their answers:
- If they excelled in word scrambles and anagrams: promote them to "Lexical Warden".
- If they excelled in word associations and homophones: promote them to "Aether Weaver".
- If they excelled in trivia and classic riddles: promote them to "Logic Sentinel".
- If they had mixed results: promote them to "Void Infiltrator".

Return a single JSON object with this schema:
{
  "className": "The awarded class name here",
  "ceremony_speech": "The Administrator's chilling, grand ceremonial promotion speech praising or mocking their aptitude. IMPORTANT: Use simple, generalized, easy-to-understand language without overly complex jargon."
}
Return ONLY the raw JSON block.`;

    // 1. Try Gemini
    const geminiApiKey = getApiKey();
    if (geminiApiKey) {
        try {
            console.log(`>> [API] Class Promotion Ceremony via Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) throw new Error(`Gemini status code: ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            if (data.candidates && data.candidates.length > 0) {
                const rawText = data.candidates[0].content.parts[0].text;
                const cleanText = rawText.replace(/```json|```/g, "").trim();
                return JSON.parse(cleanText);
            }
            throw new Error("Invalid promotion ceremony response");
        } catch (e) {
            console.warn(`>> [API] Gemini Class Ceremony failed: "${e.message}". Trying SambaNova.`);
        }
    }

    // 2. Try SambaNova
    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            return await callSambaNovaAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] SambaNova Class Ceremony failed: "${e.message}". Trying Groq.`);
        }
    }

    // 3. Try Groq
    const groqKey = getGroqApiKey();
    if (groqKey) {
        try {
            return await callGroqAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] Groq Class Ceremony failed: "${e.message}". Trying Cerebras.`);
        }
    }

    // 4. Try Cerebras
    const cerebrasKey = getCerebrasApiKey();
    if (cerebrasKey) {
        try {
            return await callCerebrasAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] Cerebras Class Ceremony failed: "${e.message}". Falling back to local promotion.`);
        }
    }

    // 5. Procedural Fallback
    console.warn(`>> [API] No AI providers succeeded/available for ceremony. Using local promotion ceremony.`);
    return runLocalPromotion();
}

function runLocalPromotion() {
    const options = ["Lexical Warden", "Aether Weaver", "Logic Sentinel", "Void Infiltrator"];
    const chosen = options[Math.floor(Math.random() * options.length)];
    return {
        className: chosen,
        ceremony_speech: `>> [LOCAL BIOS CHIP] Synchronizing neural pathways... Assigned node class: [${chosen}].`
    };
}