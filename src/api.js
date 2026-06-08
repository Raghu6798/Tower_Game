// Dynamic AI Uplink gateway calling gemini-3.5-flash
const getApiKey = () => {
    return import.meta.env.VITE_GEMINI_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.GEMINI_API_KEY : "");
};

const getSambaNovaApiKey = () => {
    return import.meta.env.VITE_SAMBANOVA_API_KEY || 
           (typeof process !== "undefined" && process.env ? process.env.SAMBANOVA_API_KEY : "");
};

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
            model: "Llama-4-Maverick-17B-128E-Instruct",
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message);
    }
    if (data.choices && data.choices.length > 0) {
        const rawText = data.choices[0].message.content;
        const cleanText = rawText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    }
    throw new Error("No output content returned from SambaNova");
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
        const data = await response.json();
        return data;
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

    // Always save to localStorage as well, so local client state is persistent and works seamlessly on static hosts like Vercel
    try {
        const localData = localStorage.getItem("admin_memory_history");
        const history = localData ? JSON.parse(localData) : [];
        history.push({ floor, challenge, player_answer, admin_remark });
        // Keep only last 5 to match server limit
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
    { question: "A 3-digit key. The second is double the first. The third is the sum of the first two. Product of all three is 36. What is the code?", hint: "Try starting with 1.", solution: "123" },
    { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", hint: "A sound wave reflection.", solution: "ECHO" },
    { question: "ASCII hex bytes: 43 4f 44 45. Translate this packet to capital letters.", hint: "43=C, 4f=O, 44=D, 45=E", solution: "CODE" },
    { question: "The more of them you take, the more you leave behind. What are they?", hint: "Footmarks left on the climbing platform.", solution: "FOOTSTEPS" },
    { question: "What is full of holes but still holds water?", hint: "Porous absorption material.", solution: "SPONGE" },
    { question: "A code has 4 digits. The first is 9. The second is first minus 6. The third is second multiplied by 3. The fourth is the sum of all first three minus 20.", hint: "Calculate: 9, 3, 9, 1", solution: "9391" },
    { question: "What has a head and a tail but no body?", hint: "A metallic currency coin.", solution: "COIN" },
    { question: "I am always hungry, I must be fed. The finger I touch will soon turn red. What am I?", hint: "Keep me away from water.", solution: "FIRE" },
    { question: "If you look at the face of my clock, you see 12. If you divide it by two, you get nothing. What am I?", hint: "Think about the shape of the digits.", solution: "8" },
    { question: "I have no beginning, end, or middle, and I'm present in every circular loop. What am I?", hint: "Zero or Ring.", solution: "RING" },
    { question: "I exist only when there is light, but direct light kills me. What am I?", hint: "Your companion on a sunny day.", solution: "SHADOW" }
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
function generateProceduralChallenge(floor) {
    const seed = floor * 7 + 13;
    const type = floor % 5;
    
    switch (type) {
        case 0: {
            // Arithmetic Sequence Challenge
            const start = (seed % 10) + 2;
            const diff = (seed % 6) + 3;
            const step1 = start + diff;
            const step2 = step1 + diff;
            const step3 = step2 + diff;
            const solution = (step3 + diff).toString();
            return {
                challenge: `Complete the sequence sequence: ${start}, ${step1}, ${step2}, ${step3}, ?`,
                administrator_intro: `Floor ${floor} sequence engine. Compute the next mathematical progression.`,
                hint: `Add ${diff} to the last number.`,
                solution: solution
            };
        }
        case 1: {
            // Hexadecimal Cipher Challenge
            const words = ["BYTE", "CORE", "GATE", "LINK", "NODE", "GRID", "FLOW", "VOID"];
            const chosen = words[seed % words.length];
            const hexRep = Array.from(chosen).map(char => char.charCodeAt(0).toString(16)).join(" ");
            return {
                challenge: `Decrypt the hex payload: ${hexRep}`,
                administrator_intro: `Floor ${floor} hex translation buffer. Convert hexadecimal byte blocks into plaintext.`,
                hint: `Standard ASCII character conversion. The word has ${chosen.length} letters.`,
                solution: chosen
            };
        }
        case 2: {
            // Boolean Logic Challenge
            const p = (seed % 2) === 0;
            const q = (seed % 3) !== 0;
            const operator = (seed % 4 > 1) ? "AND" : "OR";
            const val = operator === "AND" ? (p && q) : (p || q);
            const statement = `(${p.toString().toUpperCase()} ${operator} ${q.toString().toUpperCase()})`;
            return {
                challenge: `Resolve the boolean logic statement: NOT ${statement}`,
                administrator_intro: `Floor ${floor} gate validation sequence. Compute the final state of the logic circuit.`,
                hint: `First solve ${statement}, then apply the NOT gate. Answer with TRUE or FALSE.`,
                solution: (!val).toString().toUpperCase()
            };
        }
        case 3: {
            // String Reversal / Cipher Shift
            const words = ["SYNAPSE", "QUANTUM", "CYPHER", "RECURSION", "PROTOCOL"];
            const word = words[seed % words.length];
            const reversed = word.split("").reverse().join("");
            return {
                challenge: `Enter the inversion sequence for: "${reversed}"`,
                administrator_intro: `Floor ${floor} logic mirror. Invert the character stack to restore normal flow.`,
                hint: `Reverse the spelling of the string back to normal.`,
                solution: word
            };
        }
        default: {
            const idx = seed % offlineRiddles.length;
            const r = offlineRiddles[idx];
            return {
                challenge: r.question,
                administrator_intro: `Floor ${floor} mainframe gateway asks a classic mystery riddle.`,
                hint: r.hint,
                solution: r.solution
            };
        }
    }
}

export async function generateChallenge(floor, className) {
    const zone = getZoneInfo(floor);
    const memory = await fetchMemory();
    const apiKey = getApiKey();
    
    let memoryContext = "";
    if (memory && memory.length > 0) {
        memoryContext = "\nPREVIOUS CONVERSATION MEMORY (Use this to casually reference past interactions if relevant, but do not dwell on it):\n";
        memory.forEach(m => {
            memoryContext += `- Floor ${m.floor}: Asked "${m.challenge}". Player answered: "${m.player_answer}". You replied: "${m.admin_remark}"\n`;
        });
    }
    
    const prompt = `You are a dark, ominous cybernetic deity called "The Administrator".
Generate a themed puzzle for floor level ${floor} of your neon tower. 
The player's active class is: "${className}".
The current zone is "${zone.name}".${memoryContext}
As the floor rises (up to floor 100), the puzzles must scale in complexity.
- Easy logic/arithmetic or simple riddles for early floors (1-20).
- Medium difficulty string operations, hex conversions, word riddles, and logical gates for mid floors (21-60).
- Complex algorithmic riddles, cryptography, matrix shifts, and deep logic puzzles for high floors (61-100).

IMPORTANT: Do NOT use overly complex cyber-jargon or hard-to-understand terminology. Keep the Administrator's speech and the puzzle questions generalized, clear, and easy to read. The tone should still be dark and sarcastic, but accessible to a general audience.

You MUST return a JSON object with this exact schema:
{
  "challenge": "A clear, descriptive puzzle question in simple language",
  "administrator_intro": "Sarcastic, imposing greeting addressing their class or floor. Keep the vocabulary simple and avoid heavy jargon.",
  "hint": "A subtle clue detailing spelling, length, or logical method"
}

Ensure the puzzle has a single, definitive, short English word or number code solution (UPPER CASE).
Return ONLY the raw JSON block without markdown formatting or code blocks.`;

    if (apiKey) {
        try {
            console.log(`>> [API] Requesting Floor ${floor} challenge from Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

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

    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            return await callSambaNovaAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] SambaNova Challenge failed on Floor ${floor}: "${e.message}". Falling back to procedural logic.`);
        }
    }

    console.warn(`>> [API] No AI providers succeeded/available. Using fallback procedural challenge.`);
    return generateProceduralChallenge(floor);
}

export async function checkAnswer(floor, question, userAnswer) {
    const procedural = generateProceduralChallenge(floor);
    const memory = await fetchMemory();
    const apiKey = getApiKey();
    
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

    if (apiKey) {
        try {
            console.log(`>> [API] Checking answer semantically via Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            if (data.candidates && data.candidates.length > 0) {
                const rawText = data.candidates[0].content.parts[0].text;
                const cleanText = rawText.replace(/```json|```/g, "").trim();
                const parsed = JSON.parse(cleanText);
                
                // Save to memory asynchronously
                saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
                
                return parsed;
            }
            throw new Error("Malformed judge response");
        } catch (e) {
            console.warn(`>> [API] Gemini Semantic judge failed: "${e.message}". Trying SambaNova.`);
        }
    }

    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            const parsed = await callSambaNovaAPI(prompt);
            
            // Save to memory asynchronously
            saveMemory(floor, question, userAnswer, parsed.administrator_remarks);
            
            return parsed;
        } catch (e) {
            console.warn(`>> [API] SambaNova Semantic judge failed: "${e.message}". Falling back to client exact match.`);
        }
    }

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
        
    // Save to memory asynchronously
    saveMemory(floor, question, userAnswer, fallbackRemark);
    
    return {
        correct: isCorrect,
        administrator_remarks: fallbackRemark,
        solution: cleanSol
    };
}

export async function determineSpecializedClass(history) {
    const apiKey = getApiKey();
    const prompt = `You are conducting a "Class Promotion Ceremony" for a 100-floor tower game.
Analyze the player's chronological puzzle response logs:
${JSON.stringify(history)}

Based on their answers:
- If they excelled in hex conversions and ciphers: promote them to "Quantum Cryptographer".
- If they answered general riddles with creative flair: promote them to "Aether Hacker".
- If they cracked arithmetic riddles quickly: promote them to "Logic Sentinel".
- If they had mixed results: promote them to "Void Infiltrator".

Return a single JSON object with this schema:
{
  "className": "The awarded class name here",
  "ceremony_speech": "The Administrator's chilling, grand ceremonial promotion speech praising or mocking their aptitude. IMPORTANT: Use simple, generalized, easy-to-understand language without overly complex jargon."
}
Return ONLY the raw JSON block.`;

    if (apiKey) {
        try {
            console.log(`>> [API] Class Promotion Ceremony via Gemini API...`);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            if (data.candidates && data.candidates.length > 0) {
                const rawText = data.candidates[0].content.parts[0].text;
                const cleanText = rawText.replace(/```json|```/g, "").trim();
                return JSON.parse(cleanText);
            }
            throw new Error("Invalid promotion ceremony");
        } catch (e) {
            console.warn(`>> [API] Gemini Class Ceremony failed: "${e.message}". Trying SambaNova.`);
        }
    }

    const sambaNovaKey = getSambaNovaApiKey();
    if (sambaNovaKey) {
        try {
            return await callSambaNovaAPI(prompt);
        } catch (e) {
            console.warn(`>> [API] SambaNova Class Ceremony failed: "${e.message}". Falling back to local promotion.`);
        }
    }

    console.warn(`>> [API] No AI providers succeeded/available for ceremony. Using local promotion ceremony.`);
    return runLocalPromotion();
}

function runLocalPromotion() {
    const options = ["Quantum Cryptographer", "Aether Hacker", "Logic Sentinel", "Void Infiltrator"];
    const chosen = options[Math.floor(Math.random() * options.length)];
    return {
        className: chosen,
        ceremony_speech: `>> [LOCAL BIOS CHIP] Synchronizing neural pathways... Assigned node class: [${chosen}].`
    };
}