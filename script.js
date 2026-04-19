/* =========================================
   基本設定・状態管理
   ========================================= */
let settings = {
    clockFont: "'UD Shin Go', sans-serif",
    tickerFont: "'UD Shin Go', sans-serif",
    tickerColor: "#ffffff",
    tickerStrokeColor: "#000000",
    tickerStrokeWidth: 7,
    cameras: [{ url: "https://www.youtube.com/embed/dfVK7ld38Ys", location: "サンプル映像" }]
};

const bc = new BroadcastChannel('sokuho_channel_admin');
let currentPlayer;
let currentCameraIndex = 0;
let isTourActive = true; 
let tourInterval;
let lastSokuhoTitle = ""; // NHK速報の重複チェック用

/* =========================================
   初期化処理
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateStyles();
    updateClock();
    setInterval(updateClock, 1000);

    // キーボードイベントの登録
    window.addEventListener('keydown', handleKeyDown);

    // NHK速報の定期チェック開始 (1分おき)
    fetchNHKSokuho();
    setInterval(fetchNHKSokuho, 60000);

    // ブラウザの音声ブロック解除用
    document.body.addEventListener('click', () => {
        const audio = document.getElementById('sokuho-audio');
        if (audio) {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
            }).catch(() => {});
        }
    }, { once: true });
});

/* =========================================
   NHKニュース速報 自動取得
   ========================================= */
async function fetchNHKSokuho() {
    const targetUrl = 'https://news.web.nhk/n-data/conf/na/rss/cat0.xml'; 

    try {
        const response = await fetch(targetUrl); 
        if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const item = xmlDoc.querySelector("item");
        if (item) {
            const title = item.querySelector("title").textContent;
            console.log("RSSチェック中...", title);

            if (title !== lastSokuhoTitle) {
                playSokuhoSound();
                showNews(title);
                lastSokuhoTitle = title;
            }
        }
    } catch (error) {
        showInfoMessage(`RSS取得エラー: ${error.message}`);
    }
}

/* =========================================
   操作・イベント処理
   ========================================= */
bc.onmessage = (event) => {
    if (event.data.type === 'TEST_SOKUHO') {
        playSokuhoSound();
        showNews(event.data.text);
    }
};

function handleKeyDown(e) {
    if (e.keyCode >= 48 && e.keyCode <= 57) {
        let num = e.keyCode - 48;
        let index = num === 0 ? 9 : num - 1; 
        switchCameraDirectly(index);
    }
    if (e.key.toLowerCase() === 's') {
        toggleTour();
    }
    // Nキーで下部ニュースを手動表示（テスト用）
    if (e.key.toLowerCase() === 'n') {
        updateBottomNews();
    }
}

/* =========================================
   カメラ制御機能
   ========================================= */
function switchCameraDirectly(index) {
    if (settings.cameras[index] && settings.cameras[index].url) {
        currentCameraIndex = index;
        const nextId = extractVideoId(settings.cameras[index].url);
        if (nextId && currentPlayer && currentPlayer.loadVideoById) {
            currentPlayer.loadVideoById(nextId);
            updateCameraDisplay();
            showInfoMessage(`カメラ ${index + 1}: ${settings.cameras[index].location}`);
        }
    } else {
        showInfoMessage(`キー ${index + 1} にはカメラが設定されていません`);
    }
}

function toggleTour() {
    isTourActive = !isTourActive;
    const statusLabel = document.getElementById('tour-status');
    if (isTourActive) {
        statusLabel.innerText = "巡回: ON";
        statusLabel.classList.remove('tour-off');
        startTour();
        showInfoMessage("自動巡回を開始しました");
    } else {
        statusLabel.innerText = "巡回: OFF";
        statusLabel.classList.add('tour-off');
        stopTour();
        showInfoMessage("自動巡回を停止しました");
    }
}

function startTour() {
    stopTour();
    tourInterval = setInterval(switchNextCamera, 180000); 
}

function stopTour() {
    clearInterval(tourInterval);
}

function switchNextCamera() {
    if (!isTourActive || settings.cameras.length <= 1) return;
    currentCameraIndex = (currentCameraIndex + 1) % settings.cameras.length;
    const nextId = extractVideoId(settings.cameras[currentCameraIndex].url);
    if (nextId && currentPlayer.loadVideoById) {
        currentPlayer.loadVideoById(nextId);
        updateCameraDisplay();
    }
}

/* =========================================
   表示更新・ユーティリティ
   ========================================= */
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock-display').innerHTML = `${h}<span class="colon">：</span>${m}`;
}

function showNews(text) {
    const container = document.getElementById('ticker-container');
    document.getElementById('ticker-content').innerHTML = text;
    container.classList.remove('hidden');
    if (window.sokuhoTimeout) clearTimeout(window.sokuhoTimeout);
    window.sokuhoTimeout = setTimeout(() => { container.classList.add('hidden'); }, 30000);
}

function playSokuhoSound() {
    const audio = document.getElementById('sokuho-audio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function showInfoMessage(text) {
    const container = document.getElementById('error-container');
    const div = document.createElement('div');
    div.className = 'info-msg';
    div.innerText = text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

function loadSettings() {
    const saved = localStorage.getItem('sokuhoSettings_admin');
    if (saved) settings = JSON.parse(saved);
}

function updateStyles() {
    const infoBox = document.getElementById('info-box');
    const tickerContent = document.getElementById('ticker-content');
    if (!infoBox || !tickerContent) return;
    infoBox.style.fontFamily = settings.clockFont;
    tickerContent.style.fontFamily = settings.tickerFont;
    tickerContent.style.color = settings.tickerColor;
    tickerContent.style.webkitTextStrokeWidth = (settings.tickerStrokeWidth || 7) + "px";
    tickerContent.style.webkitTextStrokeColor = settings.tickerStrokeColor;
}

function updateCameraDisplay() {
    const cam = settings.cameras[currentCameraIndex];
    if (cam) {
        document.getElementById('camera-location').innerText = cam.location || "---";
        document.getElementById('camera-url-display').innerText = cam.url;
    }
}

function extractVideoId(url) {
    if (!url) return null;
    if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split('?')[0];
    if (url.includes('v=')) return url.split('v=')[1].split('&')[0];
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
}

/* =========================================
   YouTube Player API 連携
   ========================================= */
window.onYouTubeIframeAPIReady = function() {
    try {
        const firstId = settings.cameras[0] ? extractVideoId(settings.cameras[0].url) : 'dfVK7ld38Ys';
        currentPlayer = new YT.Player('player', {
            videoId: firstId,
            playerVars: { 'autoplay': 1, 'mute': 1, 'controls': 0, 'rel': 0, 'origin': location.origin },
            events: {
                'onReady': (e) => { 
                    e.target.playVideo(); 
                    updateCameraDisplay(); 
                    if (isTourActive) startTour();
                }
            }
        });
    } catch (e) { console.error("YT Init Error"); }
};

/* =========================================
   ページ読み込み完了時の演出
   ========================================= */
window.addEventListener('load', () => {
    const bootCard = document.getElementById('boot-card');
    if (bootCard) {
        setTimeout(() => {
            bootCard.classList.remove('boot-hidden');
            bootCard.classList.add('boot-visible');
            setTimeout(() => {
                bootCard.classList.remove('boot-visible');
                bootCard.classList.add('boot-hidden');
            }, 3000);
        }, 500);
    }
    
    // 起動から10秒後に自動で「主なニュース」を表示
    setTimeout(updateBottomNews, 10000);
});

// --- エクスポート機能 ---
document.getElementById('export-settings').onclick = () => {
    const data = localStorage.getItem('sokuhoSettings_admin');
    if (!data) {
        alert("保存された設定がありません。");
        return;
    }

    // JSONファイルを作成
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // ファイル名を「sokuho_settings_日付.json」にする
    const now = new Date();
    const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    
    a.href = url;
    a.download = `sokuho_settings_${dateStr}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    document.getElementById('io-status').innerText = "エクスポート完了！";
};

// --- インポート機能 ---
const fileInput = document.getElementById('import-file');
document.getElementById('import-trigger').onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            
            // データの形式が正しいか簡易チェック
            if (json.clockFont && json.cameras) {
                localStorage.setItem('sokuhoSettings_admin', JSON.stringify(json));
                alert("インポートが完了しました。ページを再読み込みします。");
                location.reload(); // 設定を反映させるためにリロード
            } else {
                throw new Error("不正な設定ファイルです。");
            }
        } catch (err) {
            alert("エラー: 設定ファイルの読み込みに失敗しました。");
            console.error(err);
        }
    };
    reader.readAsText(file);
};

/* =========================================
   緊急地震速報 (EEW) 取得・整形ロジック
   ========================================= */
let lastEEWEventID = ""; 

async function fetchEEW() {
    const url = 'https://api.wolfx.jp/jma_eew.json';
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();

        if (data.isCancel) {
            if (lastEEWEventID === data.EventID) {
                showNews('<span style="color: #ffffff;">先ほどの緊急地震速報は取り消されました</span>');
                lastEEWEventID = ""; 
            }
            return;
        }

        if (data.isWarn && data.EventID !== lastEEWEventID) {
            lastEEWEventID = data.EventID;
            
            // 地域名の整形（指定の定義に基づく）
            const areaText = formatEEWAreas(data.WarnArea ? data.WarnArea.Chiiki : "");
            
            const eewContent = `
                <span style="color: #ffff00;">緊急地震速報 強い揺れに警戒</span><br>
                <span style="color: #ffffff;">${areaText}</span>
            `;

            playSokuhoSound();
            showNews(eewContent);
        }
    } catch (error) {
        console.error("EEW取得エラー:", error);
    }
}

// 地域名を整形・判定するメイン関数
function formatEEWAreas(chiikiString) {
    if (!chiikiString) return "各地";

    // 1. APIの地域名から「県」「府」「都」「地方」などを除いて純粋な地名にする
    const rawAreas = chiikiString.split(' ');
    let cleanAreas = [...new Set(rawAreas.map(a => {
        if (a.includes("道東")) return "北海道道東";
        if (a.includes("道北")) return "北海道道北";
        if (a.includes("道央")) return "北海道道央";
        if (a.includes("道南")) return "北海道道南";
        if (a.includes("伊豆諸島")) return "伊豆諸島";
        if (a.includes("小笠原")) return "小笠原";
        if (a.includes("奄美")) return "奄美";
        return a.replace(/[県府都]$|地方$|南部$|北部$|東部$|西部$|中越$|下越$|上越$|佐渡$|三八上北$|津軽$|下北$|二本松$|通り$|など/g, "");
    }))];

    // 2. 文字数チェック（21文字を超える場合は地方名に集約）
    const combinedText = cleanAreas.join(' ');
    if (combinedText.length > 21) {
        return summarizeToRegions(cleanAreas);
    }

    return combinedText;
}

// 地方名への集約ロジック（指定された定義）
function summarizeToRegions(prefectures) {
    const regionDef = {
        "北海道": ["北海道道東", "北海道道北", "北海道道央", "北海道道南"],
        "東北": ["青森", "岩手", "山形", "秋田", "宮城", "福島"],
        "関東": ["茨城", "栃木", "群馬", "埼玉", "東京", "千葉", "神奈川"],
        "伊豆諸島": ["伊豆諸島"],
        "小笠原": ["小笠原"],
        "甲信": ["長野", "山梨"],
        "東海": ["愛知", "静岡", "三重", "岐阜"],
        "北陸": ["石川", "富山", "福井"],
        "新潟": ["新潟"],
        "近畿": ["滋賀", "奈良", "和歌山", "京都", "大阪", "兵庫"],
        "四国": ["愛媛", "高知", "香川", "徳島"],
        "中国": ["岡山", "広島", "鳥取", "島根", "山口"],
        "九州": ["福岡", "長崎", "佐賀", "大分", "熊本", "鹿児島", "宮崎"], // 福岡県を福岡に統一
        "奄美": ["奄美"],
        "沖縄": ["沖縄"]
    };

    let resultRegions = [];
    for (const [regionName, memberList] of Object.entries(regionDef)) {
        // その地方に含まれる県名が一つでもあれば、その地方名を追加
        if (memberList.some(m => prefectures.includes(m))) {
            resultRegions.push(regionName);
        }
    }

    // 重複を除去して結合
    return [...new Set(resultRegions)].join(' ');
}

/* =========================================
   デバッグ・テスト用関数
   ========================================= */
// ブラウザのコンソールで「testEEW()」と打つと実行されます
window.testEEW = function() {
    console.log("EEWテスト表示を実行します...");
    
    // テスト用のダミーデータ（警報・複数地域）
    const testData = {
        isWarn: true,
        EventID: "test" + Date.now(),
        WarnArea: {
            Chiiki: "長野県北部 静岡県 岐阜県 山梨県" // 21文字以内の例
        }
    };

    // 地域名の整形
    const areaText = formatEEWAreas(testData.WarnArea.Chiiki);
    
    const eewContent = `
        <span style="color: #ffff00;">緊急地震速報 強い揺れに警戒</span><br>
        <span style="color: #ffffff;">${areaText}</span>
    `;

    playSokuhoSound();
    showNews(eewContent);
};

// 地方名まとめのテスト
window.testEEWRegion = function() {
    console.log("EEW地方名まとめテストを実行します...");
    
    // 大量の地域を入れて21文字をオーバーさせる
    const testData = {
        isWarn: true,
        EventID: "test_region" + Date.now(),
        WarnArea: {
            Chiiki: "青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県"
        }
    };

    const areaText = formatEEWAreas(testData.WarnArea.Chiiki);
    
    const eewContent = `
        <span style="color: #ffff00;">緊急地震速報 強い揺れに警戒</span><br>
        <span style="color: #ffffff;">${areaText}</span>
    `;

    playSokuhoSound();
    showNews(eewContent);
};
