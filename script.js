const chatMessages = document.querySelector(".chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.querySelector(".send-btn");
const minimizeBtn = document.querySelector(".minimize-btn");
const typingIndicator = document.querySelector(".typing-indicator");
const loadingSpinner = document.querySelector(".loading-spinner");
const hamburger = document.querySelector(".hamburger");
const navLinks = document.querySelector(".nav-links");
const ctaButton = document.querySelector(".cta-button.primary");
const chatContainer = document.querySelector(".chat-container");
const contactForm = document.getElementById("contact-form");

const GEMINI_API_KEY = "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
const WEATHER_API_KEY = "";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";
const WEATHER_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";

const userPreferences = {
    name: "",
    gender: "",
    style: "",
    occasions: [],
    location: null,
    weather: null
};

document.addEventListener("DOMContentLoaded", () => {
    addMessage(
        "Hi! I'm your AI outfit assistant. Tell me your name, and I'll help you plan a look that suits your style and the weather.",
        "bot"
    );

    sendButton?.addEventListener("click", handleUserInput);
    userInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleUserInput();
        }
    });

    minimizeBtn?.addEventListener("click", () => {
        chatContainer?.classList.toggle("hidden");
    });

    hamburger?.addEventListener("click", () => {
        const isExpanded = hamburger.getAttribute("aria-expanded") === "true";
        hamburger.setAttribute("aria-expanded", String(!isExpanded));
        navLinks?.classList.toggle("active");
    });

    navLinks?.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
            hamburger?.setAttribute("aria-expanded", "false");
        });
    });

    ctaButton?.addEventListener("click", () => {
        userInput?.focus();
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", (event) => {
            const href = anchor.getAttribute("href");
            if (!href || href === "#") {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    contactForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        alert("Thanks for your message! This demo form is ready for backend integration.");
        contactForm.reset();
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userPreferences.location = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                getWeatherData();
            },
            () => {
                // Location is optional. Users can still provide their city in chat.
            }
        );
    }
});

async function handleUserInput() {
    const message = userInput?.value.trim();
    if (!message) {
        return;
    }

    addMessage(message, "user");
    userInput.value = "";
    setTyping(true);

    try {
        const response = await getBotResponse(message);
        addMessage(response, "bot");
    } catch (error) {
        console.error("Chat error:", error);
        addMessage("Something went wrong while preparing your outfit idea. Please try again.", "bot");
    } finally {
        setTyping(false);
    }
}

function addMessage(message, sender) {
    if (!chatMessages) {
        return;
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = sender === "bot" ? formatBotResponse(message) : escapeHtml(message);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatBotResponse(message) {
    if (message.includes("<div") || message.includes("<ul")) {
        return message;
    }

    return `<div class="bot-response">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function setTyping(isTyping) {
    typingIndicator?.classList.toggle("hidden", !isTyping);
    loadingSpinner?.classList.toggle("hidden", !isTyping);
}

async function getWeatherData() {
    if (!userPreferences.location || !WEATHER_API_KEY) {
        return;
    }

    try {
        const response = await fetch(
            `${WEATHER_API_URL}?lat=${userPreferences.location.lat}&lon=${userPreferences.location.lon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        if (!response.ok) {
            throw new Error("Weather request failed");
        }

        const data = await response.json();
        userPreferences.weather = {
            temp: data.main.temp,
            description: data.weather[0].description
        };
    } catch (error) {
        console.error("Weather error:", error);
    }
}

async function getBotResponse(message) {
    if (!userPreferences.name) {
        userPreferences.name = message;
        return `Nice to meet you, ${userPreferences.name}! Which city are you in? I can use that to shape the outfit for your weather.`;
    }

    if (!userPreferences.location) {
        const cityStored = await setCityFromMessage(message);
        if (cityStored) {
            return "Perfect. Now tell me your gender so I can tune the styling suggestions better.";
        }
        return "I couldn't find that city. Try another city name, or include the city and country for clarity.";
    }

    if (!userPreferences.gender) {
        userPreferences.gender = message.toLowerCase();
        return "Great. What style do you usually prefer? For example: casual, professional, ethnic, or indo-western.";
    }

    if (!userPreferences.style) {
        userPreferences.style = message;
        return `Nice choice. What occasions are you shopping or planning for? You can mention more than one, like work, wedding, party.`;
    }

    if (userPreferences.occasions.length === 0) {
        userPreferences.occasions = message
            .split(",")
            .map((occasion) => occasion.trim())
            .filter(Boolean);

        return `Saved. I can help with ${userPreferences.occasions.join(", ")}. Tell me the exact occasion or day you want an outfit for.`;
    }

    if (!GEMINI_API_KEY) {
        return buildFallbackSuggestion(message);
    }

    return getAiSuggestion(message);
}

async function setCityFromMessage(message) {
    if (!WEATHER_API_KEY) {
        userPreferences.location = { city: message };
        return true;
    }

    try {
        const response = await fetch(
            `${WEATHER_GEO_URL}?q=${encodeURIComponent(message)}&limit=1&appid=${WEATHER_API_KEY}`
        );
        if (!response.ok) {
            throw new Error("City lookup failed");
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }

        userPreferences.location = {
            city: data[0].name || message,
            lat: data[0].lat,
            lon: data[0].lon
        };

        await getWeatherData();
        return true;
    } catch (error) {
        console.error("City lookup error:", error);
        return false;
    }
}

async function getAiSuggestion(message) {
    const request = analyzeRequest(message);
    const weatherContext = userPreferences.weather
        ? `Current weather: ${userPreferences.weather.temp}°C, ${userPreferences.weather.description}.`
        : "Weather data is unavailable, so keep the outfit seasonally flexible.";

    const prompt = {
        contents: [
            {
                parts: [
                    {
                        text: `You are an AI outfit assistant. Respond in clear plain text with the exact sections:

OCCASION:
DAY:
MAIN OUTFIT
ACCESSORIES
FOOTWEAR
STYLING TIPS

Customer profile:
- Name: ${userPreferences.name}
- Gender: ${userPreferences.gender}
- Preferred style: ${userPreferences.style}
- Saved occasions: ${userPreferences.occasions.join(", ")}
- Request: ${message}
- Occasion detected: ${request.occasion}
- Timing detected: ${request.timing}
- ${weatherContext}

Keep the answer elegant, practical, and specific.`
                    }
                ]
            }
        ]
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(prompt)
    });

    if (!response.ok) {
        throw new Error("AI request failed");
    }

    const data = await response.json();
    const suggestion = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!suggestion) {
        throw new Error("AI response format was invalid");
    }

    return formatOutfitSuggestion(suggestion);
}

function analyzeRequest(message) {
    const content = message.toLowerCase();
    const occasionMap = {
        wedding: ["wedding", "marriage", "bridal", "groom"],
        sangeet: ["sangeet", "mehendi", "mehndi"],
        party: ["party", "reception", "celebration", "club", "dinner"],
        work: ["work", "office", "meeting", "professional"],
        casual: ["casual", "daily", "everyday"],
        festival: ["festival", "puja", "diwali", "holi", "navratri"],
        date: ["date", "romantic"],
        interview: ["interview", "job"]
    };

    let occasion = "general";
    for (const [key, keywords] of Object.entries(occasionMap)) {
        if (keywords.some((keyword) => content.includes(keyword))) {
            occasion = key;
            break;
        }
    }

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const timing = days.find((day) => content.includes(day)) || "any day";

    return { occasion, timing };
}

function buildFallbackSuggestion(message) {
    const request = analyzeRequest(message);
    const weatherLine = userPreferences.weather
        ? `${userPreferences.weather.temp}°C and ${userPreferences.weather.description}`
        : "mixed weather conditions";

    const suggestion = `
OCCASION: ${capitalize(request.occasion)}
DAY: ${capitalize(request.timing)}

MAIN OUTFIT
Tailored base layer in a ${userPreferences.style.toLowerCase()} direction
- Choose breathable fabric that works for ${weatherLine}
- Keep the color palette to two main tones for a cleaner result

Statement outer or second layer
- Add texture or structure to make the outfit feel intentional

ACCESSORIES
Minimal jewelry or watch
- Match metal tones across your accessories

Structured bag
- Pick a finish that supports the occasion without overpowering the outfit

FOOTWEAR
Comfort-focused pair
- Keep the footwear polished and practical for the event and weather

STYLING TIPS
Balance one standout piece with cleaner basics.
Repeat one accent color across the outfit so it feels cohesive.
If the weather changes, add or remove one light layer instead of changing the whole look.
`;

    return formatOutfitSuggestion(suggestion);
}

function formatOutfitSuggestion(suggestion) {
    const cleanedSuggestion = suggestion
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/\[|\]/g, "")
        .trim();

    const sections = cleanedSuggestion.split("\n\n");
    let html = '<div class="outfit-suggestion">';

    const request = analyzeRequest(cleanedSuggestion);

    if (userPreferences.weather) {
        html += `
            <div class="weather-info">
                <i class="fas fa-cloud-sun weather-icon"></i>
                <div class="weather-details">
                    <div class="weather-temp">${escapeHtml(String(userPreferences.weather.temp))}°C</div>
                    <div class="weather-desc">${escapeHtml(userPreferences.weather.description)}</div>
                </div>
            </div>
        `;
    }

    html += buildOutfitGallery(request.occasion);

    const headerSection = sections.find((section) => section.includes("OCCASION:") || section.includes("DAY:"));
    if (headerSection) {
        html += '<div class="outfit-header">';
        headerSection.split("\n").forEach((line) => {
            if (!line.includes(":")) {
                return;
            }

            const [label, ...rest] = line.split(":");
            html += `
                <div class="header-item">
                    <span class="header-label">${escapeHtml(label.trim())}</span>
                    <span class="header-value">${escapeHtml(rest.join(":").trim())}</span>
                </div>
            `;
        });
        html += "</div>";
    }

    const mainSections = sections.filter((section) => !section.includes("OCCASION:") && !section.includes("DAY:"));
    mainSections.forEach((section) => {
        const lines = section
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            return;
        }

        const title = lines[0].replace(/:/g, "");
        html += `
            <div class="outfit-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="${getSectionIcon(title)}"></i>
                        <span>${escapeHtml(title)}</span>
                    </h4>
                </div>
                <div class="section-content">
                    ${buildSectionItems(title, lines.slice(1))}
                </div>
            </div>
        `;
    });

    html += "</div>";
    return html;
}

function buildSectionItems(title, lines) {
    const items = [];
    let currentTitle = "";
    let details = [];

    lines.forEach((line) => {
        if (line.startsWith("-")) {
            details.push(line.slice(1).trim());
            return;
        }

        if (currentTitle) {
            items.push({ title: currentTitle, details });
        }

        currentTitle = line;
        details = [];
    });

    if (currentTitle) {
        items.push({ title: currentTitle, details });
    }

    if (!items.length) {
        return "";
    }

    const itemHtml = items
        .map((item) => {
            if (title === "STYLING TIPS") {
                return `
                    <li class="style-tip">
                        <i class="fas fa-sparkles"></i>
                        <span class="tip-text">${escapeHtml(item.title)}</span>
                    </li>
                `;
            }

            const detailsHtml = item.details.length
                ? `<ul class="item-details">${item.details
                      .map((detail) => `<li>${escapeHtml(detail)}</li>`)
                      .join("")}</ul>`
                : "";

            return `
                <li class="outfit-item">
                    <i class="fas fa-circle-check"></i>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(item.title)}</div>
                        ${detailsHtml}
                    </div>
                </li>
            `;
        })
        .join("");

    return `<ul class="item-list">${itemHtml}</ul>`;
}

function getSectionIcon(sectionTitle) {
    const icons = {
        "MAIN OUTFIT": "fas fa-shirt",
        ACCESSORIES: "fas fa-gem",
        FOOTWEAR: "fas fa-shoe-prints",
        "STYLING TIPS": "fas fa-wand-magic-sparkles",
        "WEATHER INFO": "fas fa-cloud"
    };

    return icons[sectionTitle] || "fas fa-circle";
}

function buildOutfitGallery(occasion) {
    const photos = getOutfitImages(occasion);
    if (!photos.length) {
        return "";
    }

    const cards = photos
        .map(
            (photo) => `
                <article class="outfit-photo-card">
                    <img src="${photo.src}" alt="${escapeHtml(photo.alt)}">
                    <div class="outfit-photo-caption">
                        <h4>${escapeHtml(photo.title)}</h4>
                        <p>${escapeHtml(photo.caption)}</p>
                    </div>
                </article>
            `
        )
        .join("");

    return `<div class="outfit-gallery">${cards}</div>`;
}

function getOutfitImages(occasion) {
    const galleries = {
        wedding: [
            {
                src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
                alt: "Elegant formal outfit for a wedding",
                title: "Wedding elegance",
                caption: "Rich fabrics, polished layers, and dressed-up finishing touches."
            },
            {
                src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
                alt: "Celebration outfit styling",
                title: "Reception-ready look",
                caption: "Refined color coordination for a more formal event."
            },
            {
                src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
                alt: "Fashion portrait with occasion wear",
                title: "Statement occasion wear",
                caption: "A more expressive silhouette with standout accessories."
            }
        ],
        work: [
            {
                src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
                alt: "Professional office outfit",
                title: "Office polish",
                caption: "Sharp lines, practical layers, and understated accessories."
            },
            {
                src: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
                alt: "Business casual outfit inspiration",
                title: "Business casual",
                caption: "Balanced between comfort and a professional finish."
            },
            {
                src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
                alt: "Modern workwear fashion look",
                title: "Modern workwear",
                caption: "Clean tones and tailored shapes for meetings and office days."
            }
        ],
        party: [
            {
                src: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
                alt: "Party outfit inspiration",
                title: "Night-out energy",
                caption: "Sleek textures and sharper styling details for evening plans."
            },
            {
                src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
                alt: "Dressy fashion look for a celebration",
                title: "Celebration styling",
                caption: "A dressier mood with standout footwear and accessories."
            },
            {
                src: "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=900&q=80",
                alt: "Evening outfit with bold styling",
                title: "Bold evening look",
                caption: "Stronger contrast and statement layering for party settings."
            }
        ],
        casual: [
            {
                src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
                alt: "Relaxed casual outfit inspiration",
                title: "Easy casual",
                caption: "Relaxed pieces styled cleanly for everyday wear."
            },
            {
                src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
                alt: "Simple everyday outfit with layered basics",
                title: "Layered basics",
                caption: "Comfortable essentials with enough structure to feel styled."
            },
            {
                src: "https://images.unsplash.com/photo-1506629905607-d9c297d1fd38?auto=format&fit=crop&w=900&q=80",
                alt: "Street style casual fashion look",
                title: "Street-style casual",
                caption: "A more trend-aware casual direction with smart accents."
            }
        ],
        general: [
            {
                src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
                alt: "Well styled neutral outfit",
                title: "Clean neutral palette",
                caption: "A safe, polished base you can adapt for different occasions."
            },
            {
                src: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
                alt: "Fashionable outfit inspiration",
                title: "Elevated everyday",
                caption: "Simple pieces lifted by better proportion and texture."
            },
            {
                src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
                alt: "Versatile outfit idea",
                title: "Versatile styling",
                caption: "A flexible look that can shift from day to evening."
            }
        ]
    };

    return galleries[occasion] || galleries.general;
}

function capitalize(text) {
    if (!text) {
        return "";
    }

    return text
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
