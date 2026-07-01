// Supabase 初期化
const supabaseClient = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
);

document.addEventListener('DOMContentLoaded', () => {
    // スクロール時のフェードインアニメーション
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // ===== 認証 (Supabase Google OAuth) =====
    let currentUser = null;
    let savedArticleUrls = new Set();
    let currentFilter = 'all';

    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');
    const authModal = document.getElementById('auth-modal');
    const authModalClose = document.getElementById('auth-modal-close');
    const authMessage = document.getElementById('auth-message');

    function showToast(message, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast toast-' + (type || 'success') + ' toast-show';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('toast-show'), 3000);
    }

    function openAuthModal() {
        authModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
    }

    function closeAuthModal() {
        authModal.classList.remove('open');
        document.body.style.overflow = '';
    }

    async function ensureProfile(user) {
        const { data } = await supabaseClient.from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (!data) {
            const nickname = user.user_metadata?.name || user.user_metadata?.full_name || '';
            await supabaseClient.from('profiles').insert({ id: user.id, nickname });
        }
    }

    async function fetchSavedArticles() {
        if (!currentUser) return;
        const { data } = await supabaseClient
            .from('saved_articles')
            .select('article_url')
            .eq('user_id', currentUser.id);
        savedArticleUrls = new Set((data || []).map(r => r.article_url));
        renderArticleList(currentFilter);
    }

    async function saveDiagnosisResult(top3) {
        if (!currentUser) return;
        const { error } = await supabaseClient.from('diagnosis_results').insert({
            user_id: currentUser.id,
            top1: top3[0] || null,
            top2: top3[1] || null,
            top3: top3[2] || null
        });
        if (!error) showToast('診断結果を保存しました！');
    }

    async function handleSaveArticle(btn, catKey, catLabel, article) {
        if (!currentUser) {
            openAuthModal();
            return;
        }
        if (btn.classList.contains('saved')) return;
        if (savedArticleUrls.size >= 3) {
            showToast('保存できる記事は1アカウントにつき3件までです。', 'error');
            return;
        }
        btn.disabled = true;
        btn.textContent = '保存中...';
        const { error } = await supabaseClient.from('saved_articles').insert({
            user_id: currentUser.id,
            category: catKey,
            article_title: article.title,
            article_url: article.url,
            article_desc: article.desc || article.summary
        });
        btn.disabled = false;
        if (error) {
            btn.textContent = '＋ 保存する';
            showToast('保存に失敗しました。', 'error');
        } else {
            savedArticleUrls.add(article.url);
            btn.textContent = '✓ 保存済み';
            btn.classList.add('saved');
            showToast('記事を保存しました！プロフィールで確認できます。');
        }
    }

    function updateAuthUI(session) {
        currentUser = session ? session.user : null;
        if (session) {
            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            const email = session.user.email || '';
            if (userEmailEl) userEmailEl.textContent = email;
            if (userAvatarEl) userAvatarEl.textContent = email.charAt(0).toUpperCase();
            fetchSavedArticles();
            ensureProfile(session.user);
        } else {
            loginBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
            savedArticleUrls.clear();
            renderArticleList(currentFilter);
        }
    }

    loginBtn.addEventListener('click', openAuthModal);
    authModalClose.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    document.getElementById('google-login-btn').addEventListener('click', async () => {
        const googleBtn = document.getElementById('google-login-btn');
        googleBtn.disabled = true;
        googleBtn.textContent = '接続中...';
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) {
            googleBtn.disabled = false;
            googleBtn.textContent = 'Googleでログインする';
            authMessage.textContent = 'ログインに失敗しました。しばらく後でお試しください。';
            authMessage.className = 'auth-message auth-message-error';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        showToast('ログアウトしました。');
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session);
    });

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateAuthUI(session);
    });
    // ===== 認証ここまで =====

    // 診断ロジック
    const questions = document.querySelectorAll('.question-block');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('quiz-form');
    const resultArea = document.getElementById('result-area');
    const retryBtn = document.getElementById('retry-btn');
    
    let currentQuestion = 0;

    function updateControls(direction = 'next') {
        questions.forEach((q, index) => {
            const isActive = index === currentQuestion;
            q.classList.toggle('active', isActive);
            if (isActive) {
                q.classList.remove('slide-right', 'slide-left');
                if (direction === 'next') {
                    void q.offsetWidth; // リフローを起こしてアニメーションをリセット
                    q.classList.add('slide-right');
                } else if (direction === 'prev') {
                    void q.offsetWidth;
                    q.classList.add('slide-left');
                }
            }
        });

        prevBtn.style.display = currentQuestion > 0 ? 'inline-block' : 'none';
        
        if (currentQuestion === questions.length - 1) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        }

        // プログレスバーの更新
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        if (progressBar && progressText) {
            const totalQuestions = questions.length;
            const currentStep = currentQuestion + 1;
            const percentage = (currentStep / totalQuestions) * 100;
            progressBar.style.width = percentage + '%';
            progressText.textContent = `質問 ${currentStep} / ${totalQuestions}`;
        }
    }

    form.addEventListener('change', (e) => {
        updateControls('none');
    });

    nextBtn.addEventListener('click', () => {
        // 現在の質問が選択されているか確認
        const currentInputs = questions[currentQuestion].querySelectorAll('input[type="radio"], input[type="checkbox"]');
        let answered = false;
        currentInputs.forEach(input => {
            if (input.checked) answered = true;
        });

        if (!answered) {
            alert('選択肢を選んでください。');
            return;
        }

        if (currentQuestion < questions.length - 1) {
            currentQuestion++;
            updateControls('next');
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentQuestion > 0) {
            currentQuestion--;
            updateControls('prev');
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const answers = {};
        for (let i = 1; i <= 13; i++) {
            answers['q' + i] = formData.get('q' + i);
        }

        for (let i = 1; i <= 13; i++) {
            if (!answers['q' + i]) {
                alert('すべての質問に答えてください。');
                return;
            }
        }

        calculateResult(answers);
    });

    retryBtn.addEventListener('click', () => {
        form.reset();
        currentQuestion = 0;
        updateControls('next');
        resultArea.classList.add('hidden');
        form.style.display = 'block';
    });

    function calculateResult(answers) {
        let scores = {
            sci_math: 0,
            engineering: 0,
            info_data: 0,
            agri_bio: 0,
            medical: 0,
            sports_health: 0,
            education: 0,
            business: 0,
            humanities: 0,
            intl_lang: 0,
            arts_create: 0
        };

        const { q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13 } = answers;

        // Q1: 文化祭の出し物（仕組み vs 試作）
        if (q1 === 'a') { scores.info_data += 2; scores.business += 2; scores.sci_math += 1; }
        else if (q1 === 'b') { scores.engineering += 2; scores.arts_create += 2; scores.agri_bio += 1; }

        // Q2: 新しいスマホ（技術 vs 人々）
        if (q2 === 'a') { scores.info_data += 3; scores.engineering += 2; scores.sci_math += 1; }
        else if (q2 === 'b') { scores.humanities += 2; scores.intl_lang += 1; scores.business += 1; scores.medical += 1; }

        // Q3: モチベーション（自己成長 vs 他者評価）
        if (q3 === 'a') { scores.sci_math += 2; scores.humanities += 2; scores.arts_create += 2; }
        else if (q3 === 'b') { scores.business += 3; scores.sports_health += 2; scores.education += 1; }

        // Q4: 飲食店（創作 vs 王道）
        if (q4 === 'a') { scores.intl_lang += 2; scores.arts_create += 2; scores.info_data += 1; }
        else if (q4 === 'b') { scores.medical += 2; scores.business += 1; scores.education += 1; }

        // Q5: 旅行（計画 vs ノリ）
        if (q5 === 'a') { scores.medical += 2; scores.business += 2; scores.education += 1; }
        else if (q5 === 'b') { scores.arts_create += 2; scores.info_data += 1; scores.intl_lang += 1; }

        // Q6: 充電（ワイワイ vs 静か）
        if (q6 === 'a') { scores.education += 2; scores.intl_lang += 2; scores.sports_health += 2; scores.business += 1; }
        else if (q6 === 'b') { scores.sci_math += 2; scores.humanities += 2; scores.info_data += 1; scores.arts_create += 1; }

        // Q7: 向き合う対象（物・情報 vs 人間）
        if (q7 === 'a') { scores.engineering += 2; scores.info_data += 2; scores.sci_math += 1; scores.arts_create += 1; }
        else if (q7 === 'b') { scores.medical += 2; scores.education += 2; scores.business += 1; scores.intl_lang += 1; }

        // Q8: 仕事の進め方（探求 vs 堅実）
        if (q8 === 'a') { scores.sci_math += 2; scores.arts_create += 2; scores.humanities += 1; scores.agri_bio += 1; }
        else if (q8 === 'b') { scores.business += 2; scores.medical += 2; scores.info_data += 1; }

        // Q9: テクノロジーへの関心
        if (q9 === 'a') { scores.info_data += 3; scores.engineering += 3; }
        else if (q9 === 'b') { scores.arts_create += 1; scores.business += 1; }

        // Q10: 自然・生命への関心
        if (q10 === 'a') { scores.sci_math += 3; scores.agri_bio += 2; scores.medical += 2; }
        else if (q10 === 'b') { scores.arts_create += 1; }

        // Q11: 社会・ビジネスへの関心
        if (q11 === 'a') { scores.business += 3; }

        // Q12: 人間・文化への関心
        if (q12 === 'a') { scores.humanities += 3; scores.education += 2; scores.intl_lang += 2; scores.arts_create += 1; }
        else if (q12 === 'b') { scores.arts_create += 1; }

        // Q13はアドバイス分岐用なので加算なし

        // Sort and get TOP 3
        let sortedCategories = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        let top3 = sortedCategories.slice(0, 3);
        displayResult(top3, answers);
    }

    function displayResult(top3Categories, traits) {
        const reasonEl = document.getElementById('result-reason');
        const workStyleEl = document.getElementById('work-style-desc');
        const rankingContainer = document.getElementById('ranking-container');

        // 性格・行動原理のスコア計算
        const { q1, q3, q4, q5, q6, q7 } = traits;

        // 1. 外向 vs 内向
        let extra = 50;
        if (q6 === 'a') extra += 25; else extra -= 25;
        if (q7 === 'b') extra += 15; else extra -= 15;
        if (q3 === 'b') extra += 10; else extra -= 10;
        extra = Math.max(5, Math.min(95, extra));
        const intro = 100 - extra;

        // 2. 自発 vs 外的要因
        let intrinsic = 50;
        if (q3 === 'a') intrinsic += 25; else intrinsic -= 25;
        if (q1 === 'a') intrinsic += 10;
        if (q4 === 'a') intrinsic += 10;
        intrinsic = Math.max(5, Math.min(95, intrinsic));
        const extrinsic = 100 - intrinsic;

        // 3. 開放 vs 堅実
        let openVal = 50;
        if (q4 === 'a') openVal += 30; else openVal -= 30;
        if (q1 === 'b') openVal += 10;
        if (q5 === 'b') openVal += 10;
        openVal = Math.max(5, Math.min(95, openVal));
        const stable = 100 - openVal;

        // 4. 計画 vs 柔軟
        let consc = 50;
        if (q5 === 'a') consc += 30; else consc -= 30;
        if (q1 === 'a') consc += 10;
        if (q4 === 'b') consc += 15;
        consc = Math.max(5, Math.min(95, consc));
        const flex = 100 - consc;

        // DOMの更新
        document.getElementById('bar-extraversion').style.width = extra + '%';
        document.getElementById('bar-introversion').style.width = intro + '%';
        document.getElementById('val-extraversion').textContent = extra + '%';
        document.getElementById('val-introversion').textContent = intro + '%';

        document.getElementById('bar-intrinsic').style.width = intrinsic + '%';
        document.getElementById('bar-extrinsic').style.width = extrinsic + '%';
        document.getElementById('val-intrinsic').textContent = intrinsic + '%';
        document.getElementById('val-extrinsic').textContent = extrinsic + '%';

        document.getElementById('bar-openness').style.width = openVal + '%';
        document.getElementById('bar-stability').style.width = stable + '%';
        document.getElementById('val-openness').textContent = openVal + '%';
        document.getElementById('val-stability').textContent = stable + '%';

        document.getElementById('bar-conscientious').style.width = consc + '%';
        document.getElementById('bar-flexibility').style.width = flex + '%';
        document.getElementById('val-conscientious').textContent = consc + '%';
        document.getElementById('val-flexibility').textContent = flex + '%';

        const reasons = {
            sci_math: 'あなたは「抽象的な思考」が得意で、純粋な「知的好奇心」が強いタイプです。目に見えない現象の裏にある法則を解き明かしたり、深く考え込む研究者としての適性があるため、論理的な探求が求められる分野がぴったりです。',
            engineering: 'あなたは「具体的なデータや事実」をもとに実践的な解決策を考えるのが得意で、新しいものを作り出す好奇心に溢れています。理論を現実に落とし込み、社会を便利にするエンジニア気質があるため、モノづくりの分野が最適です。',
            info_data: 'あなたはシステムや論理の仕組みを解明するのが得意で、新しい技術への適応力が高いタイプです。膨大なデータを分析して合理的な答えを導き出す知性があるため、情報やデータサイエンスの分野で輝きます。',
            agri_bio: 'あなたは自然界や生命の不思議に興味を持ち、実践的な研究やフィールドワークに取り組めるタイプです。コツコツと長期的な視点で物事を育てたり、環境問題などにアプローチする分野がぴったりです。',
            medical: 'あなたは「他者への共感性」が高く、「コツコツと計画的に努力」できる誠実なタイプです。具体的な実践力を持っており、直接的に人の命や生活を支える活動にやりがいを感じるため、医療福祉の分野に向いています。',
            sports_health: 'あなたは身体を動かすことや、人と活発に関わりながら実践的に物事に取り組むエネルギーに満ちています。他者の健康やパフォーマンス向上を直接サポートする、スポーツ・健康科学の分野が合っています。',
            education: 'あなたは「人と関わること」が好きで、相手の気持ちを汲み取るのが得意なタイプです。自分の利益よりも「人の成長や心のケア」に純粋な喜びを見出せるため、教育や対人支援など、人を深く理解する学問で輝きます。',
            business: 'あなたは「現実的」な視点を持ち、将来の安定や明確な目標に向かって努力できるタイプです。ルールやデータを正確に処理し、社会のシステムや組織を動かす実務能力に長けているため、社会科学（経済・経営・法学）が合っています。',
            humanities: 'あなたは「抽象的な概念」を深く考えるのが好きで、物事の歴史や意味を探求する才能があります。人間の文化や思想を独自の視点で捉え直す力があるため、文学や哲学、歴史などの人文学にぴったりです。',
            intl_lang: 'あなたは非常に高い「開放性」を持ち、未知の文化や新しい価値観に触れることにワクワクするタイプです。言語やコミュニケーションを通じて世界中の人と関わり、架け橋となる国際・語学系の分野に向いています。',
            arts_create: 'あなたは制約に縛られず、豊かな想像力を働かせて「自分だけのアイデア」を表現したいクリエイター気質です。内発的な動機に支えられ、美しさや感動を形にする芸術・デザイン系の分野が最適です。'
        };

        const resultsData = {
            sci_math: {
                title: '理学部',
                learn: '宇宙の始まり、素粒子の振る舞い、数学的な証明など、自然界や世界の「なぜ？」を根本から解き明かす学問です。',
                jobs: '大学や国の研究所の研究員、データサイエンティスト、システムエンジニア、中高の理科・数学教員など。',
                articles: [
                    {
                        title: '宇宙の始まりを再現する？素粒子物理学と巨大加速器',
                        desc: '宇宙が生まれた直後の超高エネルギー状態を、地上に作った巨大な円形トンネル「加速器」（電気の力で電気を帯びた粒子を光の速さ近くまでスピードアップさせる装置）の中で再現する最先端の研究です。物質の最も基本的な最小単位である「素粒子」同士を激しくぶつけ合わせることで、宇宙がどのようなルールで始まったのかを解き明かします。人類が到達していない世界の根本的な真理に挑むスリルと、知的好奇心を極限まで満たせる点が非常に面白いです。将来は大学や国の研究所で活躍する物理学者や、高度な計算能力を活かしたデータサイエンティスト、システムエンジニアなどの仕事に繋がります。この壮大な実験について、詳しくは高エネルギー加速器研究機構（KEK）のホームページをご確認ください。',
                        url: 'https://www.kek.jp/ja/'
                    },
                    {
                        title: '深海極限環境微生物が作る新薬のタネ',
                        desc: '光も届かず、もの凄い水圧がかかり、温度も氷点下に近い深海の過酷な環境で生き抜く「深海極限環境微生物」（厳しい環境に適応して特殊な生存戦略を持つ目に見えない生命体）を調査する研究です。これらの微生物は、陸上の生物が持たない特殊な化学物質を作り出すことがあり、それが人類を難病から救う新しい抗生物質や治療薬（新薬のタネ）になる可能性を秘めています。未開の深海から宝物を見つけ出す冒険のようなワクワク感が非常に面白いです。将来は製薬会社での創薬研究員やバイオテクノロジー関連の開発職、海洋資源を守る環境コンサルタントなどの仕事に繋がります。深海生物の可能性について、詳しくは海洋研究開発機構（JAMSTEC）の紹介ページをご確認ください。',
                        url: 'https://www.jamstec.go.jp/j/'
                    },
                    {
                        title: 'カオス理論と天気予報：バタフライ効果の謎',
                        desc: '「ブラジルの１匹の蝶の羽ばたきが、巡り巡ってテキサスで竜巻を引き起こすか？」という、初期のわずかなズレが将来に予測不能な大変化をもたらす現象を数学的に解き明かす「カオス理論」の研究です。天気予報がなぜ数日先までしか正確に当たらないのか、その複雑な自然界のルールを数式やコンピュータシミュレーションを用いてモデル化します。一見デタラメに見える複雑な現象の中に潜む美しい秩序（数理法則）を発見する瞬間が非常に面白いです。将来は気象予報士はもちろん、金融商品の価格変動を予測するクオンツ（金融専門職）や、IT業界の数理モデラーなどの仕事に繋がります。カオス現象の数理について、詳しくは日本気象学会のデータベースをご確認ください。',
                        url: 'https://www.metsoc.jp/'
                    }
                ]
            },
            engineering: {
                title: '工学部',
                learn: 'ロボットの制御、安全で美しい建築物の設計、新しい素材の開発など、科学の知識を応用して「モノ」を作る方法を学びます。',
                jobs: 'メーカーの製品開発職、建築士、プラントエンジニア、施工管理者など。',
                articles: [
                    {
                        title: '自己修復コンクリート：生きている建物',
                        desc: '道路やビルを造るコンクリートの中に、あらかじめ特殊な細菌と栄養分を混ぜておき、ひび割れが発生したときに細菌の働きで自動的に傷口を塞ぐ「自己修復コンクリート」の研究です。建物自身がまるで生き物の皮膚のように自ら傷を修復し、構造物の寿命を劇的に延ばす未来の建材技術です。コンクリートと微生物（バイオ）を融合させ、メンテナンス不要な都市を造るというSFのような発想が非常に面白いです。将来は建設会社での新素材開発職や、都市開発を担うゼネコンのエンジニア、インフラ管理会社の技術職などの仕事に繋がります。自己修復の仕組みについて、詳しくはコンクリート工学の研究機関のページをご確認ください。',
                        url: 'https://www.jci-net.or.jp/'
                    },
                    {
                        title: '人工クモ糸の製造：鋼鉄を超える夢の新素材',
                        desc: 'クモの糸は同じ太さの鋼鉄より強く、ナイロンよりもしなやかな驚異の繊維です。このクモの糸のタンパク質をコードする遺伝子を微生物に組み込み、人工的にクモ糸を大量生産する「バイオミメティクス」（生物の優れた構造や機能を真似して新しい技術に活かす学問）の研究です。石油資源に頼らず、環境に優しく超軽量で頑丈な未来の飛行機や衣類の素材を作る点が非常に面白いです。将来は化学・繊維メーカーでの新素材開発職や、環境対応製品を手がけるメーカーの研究開発者などの仕事に繋がります。この驚異の新素材開発について、詳しくはSpiber株式会社などの公式研究情報をご確認ください。',
                        url: 'https://spiber.inc/'
                    },
                    {
                        title: 'デザインと法律の狭間にある建築学',
                        desc: '建築とは、単に見た目が美しいデザインを描くだけの学問ではありません。地震から人の命を守る「耐震基準」や、街全体の調和を守る「都市計画法」など、厳しい法律や予算、物理的制約の中で最適な空間を設計します。自由なアートの感性と、冷徹な理系の安全計算を高いレベルで両立させ、人々の生活空間を創り出すプロセスが非常に面白いです。将来は一級建築士としてデザイン事務所で働くほか、ハウスメーカーでの意匠設計者、都市計画を主導する自治体の公務員などの仕事に繋がります。建築が受ける法的制約について、詳しくは日本建築学会の紹介ページをご確認ください。',
                        url: 'https://www.aij.or.jp/'
                    }
                ]
            },
            info_data: {
                title: '情報学部 / データサイエンス学部 など',
                learn: 'AIのアルゴリズム、プログラミング、膨大なデータから社会のトレンドを読み解く統計解析の手法などを学びます。',
                jobs: 'ITエンジニア、データアナリスト、AI開発者、Webデザイナーなど。',
                articles: [
                    {
                        title: '自動運転を支える統計と計算',
                        desc: 'AIを搭載した車がカメラやセンサー情報から歩行者や障害物を検知し、安全なルートを瞬時に判断して走る自動運転技術です。その裏側では、カメラ映像がブレた際などに周囲の状況を「確率」で推測する高度なベイズ統計や行列の計算が行われています。ただのプログラミングではなく、高度な数学の力を現実の物理的な動きに変換する点が非常に面白いです。将来は自動車メーカーの自動運転システム開発エンジニアや、AI開発ベンチャーのアルゴリズムエンジニアなどの仕事に繋がります。自動運転に用いられる統計数理について、詳しくは産業技術総合研究所（AIST）の公式研究ページをご確認ください。',
                        url: 'https://www.aist.go.jp/'
                    },
                    {
                        title: 'あなたへのおすすめ動画の秘密：レコメンド技術',
                        desc: 'SNSや動画サイトで「あなたが次に見たくなる動画」を先回りして表示する、レコメンド（おすすめ）システムのアルゴリズム研究です。ユーザーの過去のクリック履歴や視聴時間を巨大な「行列データ」として統計的に処理し、個人の見えない好みや感情の動きを数式でモデル化します。数百万人の人間の行動傾向から正確に次の動きを予測する知的な仕組みが非常に面白いです。将来はIT企業のデータアナリストや、AI開発を行うソフトウェアエンジニア、データサイエンティストなどの仕事に繋がります。レコメンドアルゴリズムの仕組みについて、詳しくは情報処理学会などの文献データベースをご確認ください。',
                        url: 'https://www.ipsj.or.jp/'
                    },
                    {
                        title: '脳と機械をつなぐブレイン・マシン・インターフェース',
                        desc: '頭の中で「右へ動け」と考えるだけでロボットアームを動かしたり、画面上の文字を入力したりする技術です。脳から発生する微弱な「脳波」（頭皮から測定できる脳活動の電気信号）をリアルタイムで解析し、コンピュータが理解できるコマンドに変換します。人間の意志を身体を通さずに直接デジタル世界に繋げるというSFのような未来を実現する点が非常に面白いです。将来は医療機器メーカーの研究開発員や、最先端のウェアラブルデバイスを設計するプロダクトデザイナーなどの仕事に繋がります。脳波解析の最先端について、詳しくは生理学研究所の紹介ページをご確認ください。',
                        url: 'https://www.nips.ac.jp/'
                    }
                ]
            },
            agri_bio: {
                title: '農学部',
                learn: '動植物の生態、遺伝子操作による品種改良、環境問題の解決策など、生命と自然に関する科学を学びます。',
                jobs: '食品・種苗メーカーの開発職、農業技術者、環境コンサルタント、バイオ・農学系研究者など。',
                articles: [
                    {
                        title: 'ホタルのDNA研究と、生物発光',
                        desc: '生きものが光る不思議に迫るのが、中部大学の発光生物学研究室です。ここでは、光る生きものの遺伝子情報を集めてライブラリー（データベース）化する「DNAバーコーディング」や、発光基質（光る物質）である「ルシフェリン」、発光酵素（光るのを助ける物質）の「ルシフェラーゼ」が未解明な生きものの発光メカニズム、そして進化の謎を、分子生物学的・生理学的なアプローチで研究しています。自分たちで見つけた生きものを使い、なぜ光るのかというシンプルな好奇心を徹底探求できる点が非常に面白い研究です。なお、この研究が将来どのような仕事に繋がるのかといった情報は元のウェブページに記載がないため、詳しくは応用生物学部や環境生物科学科のページをご確認ください。',
                        url: 'https://pfs.chubu.ac.jp/faculty/oba-yuichi/'
                    },
                    {
                        title: '砂漠でも育つ？塩水に強い「スーパー作物」の開発',
                        desc: '地球温暖化や砂漠化が進む中、真水ではなく海水を含んだ「しょっぱい土」でも枯れずに育つトマトやイネを開発する研究です。植物が塩分のストレスを和らげる「耐塩性遺伝子」を特定し、ゲノム編集（設計図である遺伝子を狙い通りに書き換える技術）を用いて過酷な環境で育つ植物を造り出します。世界中の干ばつや砂漠地帯を緑の農地に変え、食料危機を解決するダイナミックさが非常に面白いです。将来は食品・種苗メーカーの研究開発職や、国際協力機構（JICA）などの農業技術支援員などの仕事に繋がります。耐塩性植物の研究について、詳しくは日本植物生理学会の紹介ページをご確認ください。',
                        url: 'https://jspp.org/'
                    },
                    {
                        title: '昆虫食の栄養と安全性：虫を食べて世界を救う',
                        desc: 'コオロギやイモムシなどを、安全かつ美味しく食べるための科学的研究です。昆虫は、従来の牛肉や豚肉に比べて「温室効果ガスの排出量が極めて少なく」、水やエサも少量で済む環境に優しい高タンパク源（代替タンパク質）として世界中から注目されています。ゲテモノとしての見方を変え、安全な加工処理や味の分析を行って「未来の食卓」をデザインする点が非常に面白いです。将来は食品メーカーの新規食材開発者や、農林水産関連の国の研究機関の研究員などの仕事に繋がります。昆虫食の栄養価や安全性評価について、詳しくは農林水産省の「フードテック」関連資料をご確認ください。',
                        url: 'https://www.maff.go.jp/'
                    }
                ]
            },
            medical: {
                title: '医学部',
                learn: '人体の構造や病気のメカニズム、薬の働き、心身に障がいを持つ人々を社会全体でどうサポートするかを学びます。',
                jobs: '医師、看護師、理学療法士、作業療法士、臨床検査技師、医療系研究者など。',
                articles: [
                    {
                        title: 'iPS細胞によるミニ臓器（オルガノイド）の作成と病気解明',
                        desc: 'あらゆる細胞になれるiPS細胞から、本物の人間の臓器そっくりの立体的なミニチュア「オルガノイド」を試験管の中で育てる研究です。これにより、これまで難しかった「人間の脳や心臓がどのように病気になっていくか」をリアルタイムで観察したり、新薬を安全に試したりすることができます。人体を傷つけることなく、精巧なミクロの生命現象を目の前で再現し観察できる点が非常に面白いです。将来は病院の医師として治療にあたるほか、大学病院の再生医療研究員、製薬会社の新薬開発リーダーなどの仕事に繋がります。ミニ臓器の作成技術について、詳しくは京都大学iPS細胞研究所（CiRA）のページをご確認ください。',
                        url: 'https://www.cira.kyoto-u.ac.jp/'
                    },
                    {
                        title: 'がん細胞の「兵糧攻め」：血管新生阻害療法',
                        desc: 'がん細胞は急激に成長するために、周囲から酸素や栄養を奪うための新しい専用の血管を伸ばします。この「血管新生」（既存の血管から新しい血管が伸びて形成される現象）を邪魔し、がんを栄養不足にして飢え死にさせる革新的な治療の研究です。がん細胞そのものを攻撃するのではなく、がんが生きていく「環境」を封鎖して身体に優しく治すというアプローチが非常に面白いです。将来はがん治療の専門医や、がん研究センターなどの研究機関の研究員、外資系製薬会社の新薬プロジェクトメンバーなどの仕事に繋がります。血管新生阻害の最先端について、詳しくは国立がん研究センターの紹介ページをご確認ください。',
                        url: 'https://www.ncc.go.jp/ja/'
                    },
                    {
                        title: '腸内細菌と心の関係：脳腸相関（のうちょうそうかん）',
                        desc: 'お腹の中に住む100兆個以上もの腸内細菌が、自律神経やホルモンを介して私たちの「脳の働き」や「気分の変化（うつ病など）」にまで大きな影響を及ぼしている現象「脳腸相関」の研究です。お腹の健康状態が、頭の思考や心の状態と深く繋がっているという意外な双方向システムを解き明かします。食べ物や腸内フローラ（腸内細菌の集まり）を改善することで心の病気を治療できるかもしれないという点が非常に面白いです。将来は精神科医や、カウンセラー、乳酸菌飲料などを手がける大手食品メーカーの研究開発員などの仕事に繋がります。脳と腸のつながりについて、詳しくは日本乳酸菌学会のホームページをご確認ください。',
                        url: 'https://jslab.jp/'
                    }
                ]
            },
            sports_health: {
                title: '薬学部 / 健康科学部 など',
                learn: '薬の正しい開発方法、人体の生理作用、病気や健康に関する科学的知識を総合的に学びます。',
                jobs: '病院・調剤薬局の薬剤師、製薬会社での創薬研究開発職、MR（医薬情報担当者）、公務員（薬事）など。',
                articles: [
                    {
                        title: '狙った場所にだけ薬を届ける「ドラッグデリバリーシステム (DDS)」',
                        desc: '薬が体中の健康な細胞にまで届いて副作用を起こすのを防ぐため、病気のある「がん細胞などの標的」にだけピンポイントで薬を届けて機能させる「ドラッグデリバリーシステム（DDS）」の研究です。薬をナノメートルサイズの極小カプセルに包み、狙った場所の温度や酸性度に反応して中身を放出する精密な設計を行います。工学や化学を応用して、薬の効き目を最大化し副作用をゼロにする製剤設計が非常に面白いです。将来は製薬会社での製剤研究者や、医療機関の薬剤師、バイオベンチャーの技術者などの仕事に繋がります。DDSのメカニズムについて、詳しくは日本DDS学会の紹介ページをご確認ください。',
                        url: 'https://www.dds-society.jp/'
                    },
                    {
                        title: 'AIが数日で見つける？次世代の「AI創薬」',
                        desc: 'これまで新しい薬を1つ開発するためには、10年以上の歳月と数千億円の膨大なコストがかかっていました。この創薬プロセスにAI（人工知能）を取り入れ、何億通りもの化学物質の組み合わせから「特定の病気の標的にピタッとはまる化合物」をシミュレーションで一瞬にして見つけ出す研究です。最先端の機械学習によって難病の特効薬候補を劇的スピードで設計する点が非常に面白いです。将来は大手製薬会社の創薬エンジニアや、バイオインフォマティクス（情報生命科学）の研究者などの仕事に繋がります。AIを用いた薬づくりの現場について、詳しくは日本薬学会のホームページをご確認ください。',
                        url: 'https://www.pharm.or.jp/'
                    },
                    {
                        title: '薬の飲み合わせの謎を解く「薬物相互作用」',
                        desc: '複数の薬を一緒に飲んだり、グレープフルーツジュースなどの特定の食品と一緒に摂取したときに、薬の効果が異常に強まったり消えたりしてしまう「薬物相互作用」の研究です。体内で薬を分解する「代謝酵素」の働きが、他の成分によって邪魔されたり促進されたりするミクロの化学反応を解き明かします。患者さんが安全に治療を受けられるよう、薬理学のデータから危険な組み合わせを事前に予測する点が非常に面白いです。将来は病院や調剤薬局で安全な指導を行う専門薬剤師や、製薬会社の臨床開発・安全性評価員などの仕事に繋がります。飲み合わせの科学について、詳しくは日本薬学会の紹介ページをご確認ください。',
                        url: 'https://www.pharm.or.jp/'
                    }
                ]
            },
            education: {
                title: '教育学部',
                learn: '人間の心の発達や感情の仕組み、効果的な学習・指導方法、そして誰もが生きやすい社会のあり方を学びます。',
                jobs: '学校の教員（小・中・高・支援学校）、教育系企業の教材開発職、学芸員、公務員など。',
                articles: [
                    {
                        title: 'ゲームの仕組みで学習意欲を高める「ゲーミフィケーション」',
                        desc: 'ロールプレイングゲームの「レベルアップ」「クエスト攻略」「バッジ獲得」といった、人間が思わず熱中してしまう仕組みを、算数や英語などの勉強・授業プランに応用する教育研究です。「勉強させられる」という受動的な態度から、「もっと知りたいから挑戦する」という自発的な学び（アクティブラーニング）へ引き出す授業デザインが非常に面白いです。将来は小学校や中学校・高校の教員として新しい教育を実践するほか、教育系IT企業での教育ゲーム・教材プランナーなどの仕事に繋がります。ゲーム要素と学習意欲について、詳しくは日本教育工学会の研究発表資料をご確認ください。',
                        url: 'https://www.jset.gr.jp/'
                    },
                    {
                        title: '「デジタル教科書」と紙の教科書の脳科学的比較',
                        desc: 'タブレットPCを使った学習と、従来の紙の教科書を使った学習で、脳の働き（記憶の定着率や集中している度合い）がどう変わるのかを脳波測定やテストデータを用いて比較分析する研究です。ICT教育（情報通信技術を用いた教育）が急速に進む教育現場で、デジタルと紙のそれぞれの良さ（メディア特性）を活かした最適な教育法を科学的に突き止める点が非常に面白いです。将来は教育委員会での学習環境プランナーや、学校の教員、デジタル教材を制作するIT企業のエンジニアなどの仕事に繋がります。この効果測定について、詳しくは文部科学省のデジタル学習検討資料をご確認ください。',
                        url: 'https://www.mext.go.jp/'
                    },
                    {
                        title: '不登校と多様な学びの選択肢：フリースクールの役割',
                        desc: '不登校の子供たちが増加する中、学校という既存の枠組みにとらわれず、フリースクールやオンライン授業といった多様な環境で子供たちが主体的に学ぶ方法を研究する分野です。一律の集団指導ではなく、個人のペースに合わせた「オルタナティブ教育」（伝統的な学校とは異なる新しい教育システム）のあり方を設計します。一人ひとりの心に寄り添い、その子が社会と繋がる「学びの居場所」をデザインする点が非常に面白いです。将来はスクールカウンセラーや、フリースクールの設立・運営者、地域の教育相談員などの仕事に繋がります。不登校支援のあり方について、詳しくは文部科学省の不登校対策資料をご確認ください。',
                        url: 'https://www.mext.go.jp/'
                    }
                ]
            },
            business: {
                title: '経済学部 / 法学部 など',
                learn: '社会におけるお金やモノの動き（経済・経営）、社会をより良く動かしトラブルを解決するルール（法）を学びます。',
                jobs: '企業の総合職、公務員、銀行員、公認会計士、税理士、弁護士など。',
                articles: [
                    {
                        title: 'スマホゲームのガチャにハマる行動経済学',
                        desc: '人間が「あと1回だけガチャを引けば絶対にレアキャラが当たるはず」などと、非合理にお金を使ってしまう心理を実験やデータから解き明かす「行動経済学」の研究です。従来の「人間は常に合理的に得する選択をする」という経済学の仮定を破り、実際の不完全な人間心理（プロスペクト理論など）をモデル化します。人間の不合理な選択のクセを突き止め、より良い社会の行動誘導（ナッジ）に活かす点が非常に面白いです。将来は企業のマーケティングディレクターや、金融機関の企画職、消費者行動を分析するデータアナリストなどの仕事に繋がります。不合理な経済心理について、詳しくは行動経済学会の公式ページをご確認ください。',
                        url: 'http://www.abem.jp/'
                    },
                    {
                        title: '自動運転車が事故を起こしたら、責任は誰にある？AIと法律',
                        desc: 'AIを搭載した完全自動運転車が事故を起こして歩行者をはねてしまったとき、責任を取るべきなのは運転席にいた人か、車を作ったメーカーか、それともAIのプログラマーなのかを追求する法学の研究です。技術の急速な進化に対し、これまでの法律（製造物責任法や民法）をどのように新しく解釈し直すべきかという現代の法秩序のルール作りを考える点が非常に面白いです。将来は弁護士や裁判官といった法曹三者や、企業の法務部門での法務専門スタッフ、交通政策を企画する公務員などの仕事に繋がります。自動運転の民事責任問題について、詳しくは内閣府などの自動運転に関する有識者検討資料をご確認ください。',
                        url: 'https://www.cao.go.jp/'
                    },
                    {
                        title: 'チケットの高額転売を防ぐ「マーケットデザイン」',
                        desc: 'ライブのチケットや臓器移植のドナー探しなど、「高値で売ればいい」だけでは社会的不平等や不公平が生じる市場において、全員がハッピーになる最適なルールを数学的に設計する「マーケットデザイン」の研究です。ゲーム理論（相手の行動を予測して自分の戦略を決める理論）を用いて、転売を防止しつつ欲しい人に確実に行き渡る分配システムを設計する点が非常に面白いです。将来はIT企業のプラットフォーム設計者や、国の政策立案者、オークション制度を設計する経済コンサルタントなどの仕事に繋がります。この配分アルゴリズムについて、詳しくは日本経済学会の学術論文データベースをご確認ください。',
                        url: 'http://www.jeaweb.org/'
                    }
                ]
            },
            humanities: {
                title: '文学部',
                learn: '言語が生まれたルーツ、世界・日本の歴史、人間の思想・哲学など、人間が創り出してきた文化そのものを深く考察する学問です。',
                jobs: '出版・メディア編集者、学芸員、教員、図書館司書、企業の広報・マーケティング職など。',
                articles: [
                    {
                        title: 'メタバースやAI時代の「心」を考える哲学・倫理学',
                        desc: '「もしAIが高度な感情や自己意識を持ったら、人権を認めるべきなのか？」「仮想空間（メタバース）での体験やアイデンティティは、現実の自分と同じ価値を持つのか？」という、テクノロジーと人間の関係を考える新しい哲学・倫理学の研究です。科学の進歩がもたらす新しい社会の中で、私たちがどう生きるべきか、倫理的な基準（AI倫理）を深く問い直す点が非常に面白いです。将来は企業のAI倫理コンサルタントや、公務員、大学の哲学者、高校の倫理教員などの仕事に繋がります。これからのテクノロジーと「心」の議論について、詳しくは日本哲学会の公式ページをご確認ください。',
                        url: 'http://philosophy-japan.org/'
                    },
                    {
                        title: '消えゆく地方の「方言」を保存する社会言語学',
                        desc: '過疎化や標準語の普及によって失われつつある地方の方言を、現地で録音してデータ化し、言葉の地域的な違いを地図上にマッピングする「言語地図」作成や社会言語学の研究です。言葉のわずかな変化から、その土地の歴史や文化、人々のコミュニティの結びつきのルーツを学問的に解き明かす点が非常に面白いです。将来は中学校・高校の国語教員や、地域の歴史や文化財を保護する学芸員、言語データの記録・解析を担うソフトウェアエンジニアなどの仕事に繋がります。失われつつある言語アーカイブについて、詳しくは日本言語学会のホームページをご確認ください。',
                        url: 'http://www.lsj.gr.jp/'
                    },
                    {
                        title: '日本古代の「怨霊（おんりょう）」と怪異の歴史文学',
                        desc: '古事記や源氏物語、説話集に描かれた「幽霊」や「生霊（いきりょう）」などの怪異を通して、平安時代などの昔の人がなぜ怪奇現象を信じ、それがどのように物語として消費されたのかを読み解く文学研究です。昔の人が抱いた「恐怖」や「怒り」といった心の動きを文献から探り、当時の歴史的背景や信仰の構造を明らかにする点が非常に面白いです。将来は国語や古典の教員をはじめ、出版社の編集者、歴史文化を紹介するライター、観光産業のコンテンツプランナーなどの仕事に繋がります。怪異文学の歴史について、詳しくは日本文学協会の学術データベースをご確認ください。',
                        url: 'http://www.nihonbungaku.or.jp/'
                    }
                ]
            },
            intl_lang: {
                title: '社会学部 / 国際・教養系 など',
                learn: '現代社会の家族やメディアの諸問題、世界の異文化、人々の多様な関係性のあり方を社会学の視点から広く探求します。',
                jobs: 'マスコミ・メディア関連、広告代理店、外資系企業、旅行・観光業界、公務員など。',
                articles: [
                    {
                        title: 'なぜ「推し活」は人を救うのか？ファンコミュニティの社会学',
                        desc: 'アイドルやアニメキャラクターを熱狂的に応援する「推し活」。これが現代社会を生きる人々にとって、単なる趣味を超えてなぜ強い「生きがい」や「自己アイデンティティ（自分らしさ）」の獲得に繋がっているのかを分析する社会学の研究です。インタビューやアンケートを通して、同じ関心を持つ人々が集まる「ファンコミュニティ」が、現代の孤独をどのように解消しているのかを解き明かす点が非常に面白いです。将来は広告代理店の企画職や、エンタメ業界のマーケター、世論調査を行う社会調査士などの仕事に繋がります。現代のコミュニティ分析について、詳しくは日本社会学会のホームページをご確認ください。',
                        url: 'https://jss-sociology.org/'
                    },
                    {
                        title: 'SNSの「フィルターバブル」が引き起こす社会の分断',
                        desc: 'スマホのAIアルゴリズムが、あなたの興味や好みに合う情報ばかりを自動的に表示することで、自分の意見と異なる情報が見えなくなってしまう「フィルターバブル」現象の研究です。自分の「見たいもの」だけが並ぶことで偏った思考が強化され、SNS上で他者との対立や社会の分断がなぜ起きるのかを分析します。インターネット時代の情報流通の裏に潜むリスクを科学的に解き明かす点が非常に面白いです。将来はメディア業界のジャーナリストや、IT企業のSNSアナリスト、コンテンツ設計者などの仕事に繋がります。アルゴリズムが与える社会影響について、詳しくは情報通信学会などの文献をご確認ください。',
                        url: 'https://www.jsicr.jp/'
                    },
                    {
                        title: '都市の中の「見えない居場所」：サードプレイスの研究',
                        desc: '自宅（第1の場所）でも、学校や職場（第2の場所）でもない、カフェや地域のコミュニティスペースといった心地よく過ごせる「サードプレイス（第3の場所）」が、人々の心の健康や地域の繋がりをどう維持するのかを調べる都市社会学の研究です。都市の空間デザインが、人々の幸福感や孤独感の解消にどのように影響するかという謎を明らかにします。何気ない日常の居場所の重要性をデータで可視化するプロセスが非常に面白いです。将来は都市計画のデザイナーや、地域のまちづくりを手がけるコンサルタント、不動産企画などの仕事に繋がります。地域のつながりについて、詳しくは一般社団法人地域交流センターなどの紹介ページをご確認ください。',
                        url: 'http://www.kouryu.or.jp/'
                    }
                ]
            },
            arts_create: {
                title: '芸術学部 / 美術・音楽系 など',
                learn: '絵画、デザイン、音楽、映像、さらには宇宙のルール構築など、幅広い表現技術や人間が生み出す作品の真髄を学びます。',
                jobs: 'デザイナー、クリエイター、作曲家、映像監督、プランナーなど。',
                articles: [
                    {
                        title: 'なぜ有名な絵画は数億円もするの？アート市場の秘密',
                        desc: 'ゴッホやピカソといった世界的な名画が、なぜ数億円から数百億円もの超高額で取引されるのかという「アート市場の価値基準」を解き明かす芸術学・美術史の研究です。作品の美しさだけでなく、画家が生きた歴史的背景や、絵画がアート業界の専門家によってどう評価・プロデュースされてきたのかという価値形成の裏側を探ります。主観的な「美」に客観的な価値がつく謎を解明するプロセスが非常に面白いです。将来は美術館の学芸員（キュレーター）や、アートディーラー、オークションハウスのスペシャリストなどの仕事に繋がります。美術品の価値形成について、詳しくは芸術関連の学会などの資料をご確認ください。',
                        url: 'https://www.tobunken.go.jp/'
                    },
                    {
                        title: 'ヒットする音楽に隠された「コード進行」の数学的パターン',
                        desc: '人々が「この曲はエモい」「一度聴いたら忘れられない」と感じるヒット曲の裏側に潜む、共通した「コード進行」（和音の並び）の数学的パターンを分析する音楽理論の研究です。なぜ特定の和音の並びが、人間の脳に心地よさや感動、懐かしさを引き起こすのかを、音響心理学や統計分析を用いて明らかにします。感性で聴く音楽を、冷徹な科学データで分解して解明する点が非常に面白いです。将来は作曲家や音楽プロデューサー、ゲーム音楽のクリエイター、音楽配信サービスのアルゴリズム開発者などの仕事に繋がります。ヒット曲の音響分析について、詳しくは日本音楽学会のホームページなどをご確認ください。',
                        url: 'http://www.musicology-japan.org/'
                    },
                    {
                        title: '宇宙旅行時代の法律：「宇宙法」と月資源の所有権',
                        desc: '民間人が気軽に宇宙旅行に行けるようになった未来、宇宙空間や月面で犯罪が起きたらどこの国の法律で裁くべきか、また月で発見された希少な資源は誰の所有物になるのかを議論する「宇宙法」の研究です。どこの国も宇宙を独占してはならないと定める「宇宙条約」をベースに、宇宙ビジネスの拡大に伴う地球外の法秩序を設計します。地球の限界を超えて広がる法律の新たなフロンティアを開拓する点が非常に面白いです。将来は国際機関の宇宙政策アドバイザーや、宇宙ベンチャー企業の法務担当、国際弁護士などの仕事に繋がります。宇宙法について、詳しくは宇宙航空研究開発機構（JAXA）の宇宙法・政策に関するページをご確認ください。',
                        url: 'https://www.jaxa.jp/'
                    }
                ]
            }
        };

        // 1位のカテゴリーをベースに総合的な理由を表示
        reasonEl.textContent = reasons[top3Categories[0]];

        // 働き方のテキストを生成
        if (workStyleEl && traits) {
            let wsText = "<strong>【あなたの行動原理】</strong><br>";
            
            if (traits.q3 === 'a') {
                wsText += "あなたは「自分自身の納得感や内なる好奇心」を原動力（内発的動機）として行動するタイプです。";
            } else {
                wsText += "あなたは「他者からの評価や社会への影響力」をモチベーション（外発的動機）として頑張れるタイプです。";
            }

            if (traits.q6 === 'a') {
                wsText += "また、人と関わりながらワイワイと進めることでエネルギーを得るため、";
            } else {
                wsText += "また、一人の時間を大切にし、深く思考することでエネルギーを得るため、";
            }

            if (traits.q4 === 'a') {
                wsText += "変化の多い環境や新しいことへの挑戦を好みます。<br><br>";
            } else {
                wsText += "決まったルーティンや安定した環境の中で着実に物事を進めるのを好みます。<br><br>";
            }

            wsText += "<strong>【向いている仕事・環境】</strong><br>";
            if (traits.q6 === 'b' && traits.q3 === 'a') {
                wsText += "一人で黙々と深く探求できる「研究職」や「専門職（エンジニア・クリエイターなど）」が非常に向いています。自分のペースで納得いくまでクオリティを高められる環境で最大のパフォーマンスを発揮します。";
            } else if (traits.q6 === 'a' && traits.q3 === 'b') {
                wsText += "チームを引っ張ったり、多くの人と関わりながら成果を上げる「企画職」「営業職」「マネジメント職」などに適性があります。他者からの感謝や目に見える評価がダイレクトに返ってくる環境で輝きます。";
            } else if (traits.q6 === 'a' && traits.q3 === 'a') {
                wsText += "人と関わることは好きですが、評価よりも「相手の役に立ったか」「良いものを作れたか」を重視します。「教育関連」「医療・福祉」「対人サポート職」など、他者の成長やケアに直接関わる仕事に向いています。";
            } else if (traits.q6 === 'b' && traits.q3 === 'b') {
                wsText += "一人で集中して作業しつつも、その結果が社会にどう影響を与えるかを重視します。「データアナリスト」「財務・会計」「Webマーケティング」など、専門スキルを用いて組織や社会に確かな貢献をする仕事が合っています。";
            }

            if (traits.q5 === 'a') {
                wsText += " 計画的にコツコツと努力できるため、長期的なプロジェクトや正確性が求められる業務でも高く信頼されます。";
            } else {
                wsText += " 柔軟性が高く、型にはまらない発想ができるため、ゼロからイチを生み出すような業務で力を発揮します。";
            }
            
            workStyleEl.innerHTML = wsText;
        }

        rankingContainer.innerHTML = '';

        top3Categories.forEach((cat, index) => {
            const data = resultsData[cat];
            const rankBlock = document.createElement('div');
            rankBlock.className = 'ranking-block fade-in visible';

            const articlesHtml = data.articles.map(article => `
                <div class="article-card">
                    <h6>${article.title}</h6>
                    <p>${article.desc}</p>
                    ${article.url ? `<p class="article-link" style="font-size:0.85rem; margin-top:0.8rem; text-align:right;"><a href="${article.url}" target="_blank" style="color:var(--primary-color); text-decoration:underline; font-weight:600;">🔍 J-Stageや大学HPで調べる</a></p>` : ''}
                </div>
            `).join('');

            let html = `
                <div class="ranking-rank">第${index + 1}位</div>
                <h4 class="ranking-title">${data.title}</h4>
                <div class="ranking-section">
                    <h6>📚 大学で学べること</h6>
                    <p>${data.learn}</p>
                </div>
                <div class="ranking-section">
                    <h6>💼 就く人が多い職業</h6>
                    <p>${data.jobs}</p>
                </div>
            `;

            // q13 === 'b' の場合、「現実的な進路アプローチ」を追加
            if (traits.q13 === 'b') {
                let adviceText = '';
                if (cat === 'sci_math') adviceText = '国公立大学への進学による学費抑制や、データサイエンス等、就職に直結するスキルの習得を並行して行うルートがおすすめです。';
                else if (cat === 'engineering') adviceText = '工学部は就職率が非常に高く、大学推薦枠も豊富です。企業との共同研究が盛んな大学を選ぶと、就職活動がさらに有利になります。';
                else if (cat === 'info_data') adviceText = 'IT業界はスキル重視のため、大学名以上にポートフォリオ（作品）が評価されます。奨学金制度を利用しつつ、在学中からインターンで実務経験を積むのが得策です。';
                else if (cat === 'agri_bio') adviceText = 'バイオ系は大学院進学率が高く費用がかかる傾向があります。地方の国公立大学は農学系に強く、生活費も抑えられるため現実的な選択肢となります。';
                else if (cat === 'medical') adviceText = '医学部は非常に高額ですが、自治体の「地域枠」や病院の給付型奨学金を利用するルートがあります。または4年制の医療技術職（放射線技師など）も安定かつ早期就労が可能です。';
                else if (cat === 'sports_health') adviceText = 'スポーツトレーナー等の資格取得には専門学校というルートもありますが、大学で教員免許や健康運動指導士などを取得することで、就職の安定性が高まります。';
                else if (cat === 'education') adviceText = '教員養成系は国公立大学の定員が多く、学費を抑えやすい分野です。また、自治体の奨学金返還免除制度なども活用しやすい傾向にあります。';
                else if (cat === 'business') adviceText = '経済・経営系は文系の中で最も就職の選択肢が広く、潰しが効く分野です。資格取得支援が手厚い大学を選ぶと、公認会計士などの強力な武器を手に入れられます。';
                else if (cat === 'humanities') adviceText = '人文学は専門が就職に直結しにくい側面があるため、教員免許の取得や、ITスキル・語学を並行して学ぶなど、「＋α」の実学スキルを持つことで就活の不安を払拭できます。';
                else if (cat === 'intl_lang') adviceText = '留学費用がネックになる場合は、国内で留学生と交流できる環境が整った大学や、大学の交換留学制度（学費免除）をフル活用するルートが現実的です。';
                else if (cat === 'arts_create') adviceText = '芸術分野は学費が高めですが、国公立の芸術大学を目指す、または一般大学のデザイン・メディア情報系学部を選択することで、費用を抑えつつクリエイティブなスキルを磨けます。';

                html += `
                <div class="ranking-section realistic-advice" style="background-color: rgba(255, 204, 0, 0.1); padding: 1rem; border-left: 4px solid #ffcc00; margin-top: 1rem;">
                    <h6 style="color: #ff9900;">🛤️ 現実的な進路アプローチ</h6>
                    <p style="font-size: 0.9rem; margin-bottom: 0;">${adviceText}</p>
                </div>
                `;
            }

            html += `
                <div class="ranking-section">
                    <h6>🔍 興味のタネ（面白いトピック）</h6>
                    <div class="articles-container">
                        ${articlesHtml}
                    </div>
                </div>
            `;

            rankBlock.innerHTML = html;
            rankingContainer.appendChild(rankBlock);
        });

        // ローディング表示処理
        const loader = document.getElementById('loader');
        form.style.display = 'none';
        loader.classList.remove('hidden');
        loader.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            loader.classList.add('hidden');
            resultArea.classList.remove('hidden');
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            saveDiagnosisResult(top3Categories);
        }, 1800);
    }

    // ===== 記事一覧機能 =====
    const articleIndex = {
        sci_math: { label: '理学', articles: [
            { title: '宇宙の始まりを再現する？素粒子物理学と巨大加速器', summary: '巨大加速器で素粒子を光速近くまで加速させ衝突。宇宙誕生直後の超高エネルギー状態を地上で再現する最先端物理学。', desc: '宇宙が生まれた直後の超高エネルギー状態を、地上に作った巨大な円形トンネル「加速器」（電気の力で電気を帯びた粒子を光の速さ近くまでスピードアップさせる装置）の中で再現する最先端の研究です。物質の最も基本的な最小単位である「素粒子」同士を激しくぶつけ合わせることで、宇宙がどのようなルールで始まったのかを解き明かします。人類が到達していない世界の根本的な真理に挑むスリルと、知的好奇心を極限まで満たせる点が非常に面白いです。将来は大学や国の研究所で活躍する物理学者や、高度な計算能力を活かしたデータサイエンティスト、システムエンジニアなどの仕事に繋がります。', url: 'https://www.kek.jp/ja/' },
            { title: '深海極限環境微生物が作る新薬のタネ', summary: '光も届かない深海の過酷環境で生きる微生物が作る特殊な化学物質。難病を救う新しい抗生物質の候補を海の底に探す研究。', desc: '光も届かず、もの凄い水圧がかかり、温度も氷点下に近い深海の過酷な環境で生き抜く「深海極限環境微生物」（厳しい環境に適応して特殊な生存戦略を持つ目に見えない生命体）を調査する研究です。これらの微生物は、陸上の生物が持たない特殊な化学物質を作り出すことがあり、それが人類を難病から救う新しい抗生物質や治療薬（新薬のタネ）になる可能性を秘めています。未開の深海から宝物を見つけ出す冒険のようなワクワク感が非常に面白いです。将来は製薬会社での創薬研究員やバイオテクノロジー関連の開発職、海洋資源を守る環境コンサルタントなどの仕事に繋がります。', url: 'https://www.jamstec.go.jp/j/' },
            { title: 'カオス理論と天気予報：バタフライ効果の謎', summary: 'なぜ天気予報は数日先しか当たらないのか？初期のわずかなズレが大変化をもたらす「カオス」の数学的な法則を解き明かす。', desc: '「ブラジルの１匹の蝶の羽ばたきが、巡り巡ってテキサスで竜巻を引き起こすか？」という、初期のわずかなズレが将来に予測不能な大変化をもたらす現象を数学的に解き明かす「カオス理論」の研究です。天気予報がなぜ数日先までしか正確に当たらないのか、その複雑な自然界のルールを数式やコンピュータシミュレーションを用いてモデル化します。一見デタラメに見える複雑な現象の中に潜む美しい秩序（数理法則）を発見する瞬間が非常に面白いです。将来は気象予報士はもちろん、金融商品の価格変動を予測するクオンツ（金融専門職）や、IT業界の数理モデラーなどの仕事に繋がります。', url: 'https://www.metsoc.jp/' }
        ]},
        engineering: { label: '工学', articles: [
            { title: '自己修復コンクリート：生きている建物', summary: 'コンクリートに混ぜた細菌がひび割れを自動で塞ぐ次世代建材。メンテナンスが不要な都市インフラを生み出す研究。', desc: '道路やビルを造るコンクリートの中に、あらかじめ特殊な細菌と栄養分を混ぜておき、ひび割れが発生したときに細菌の働きで自動的に傷口を塞ぐ「自己修復コンクリート」の研究です。建物自身がまるで生き物の皮膚のように自ら傷を修復し、構造物の寿命を劇的に延ばす未来の建材技術です。コンクリートと微生物（バイオ）を融合させ、メンテナンス不要な都市を造るというSFのような発想が非常に面白いです。将来は建設会社での新素材開発職や、都市開発を担うゼネコンのエンジニア、インフラ管理会社の技術職などの仕事に繋がります。', url: 'https://www.jci-net.or.jp/' },
            { title: '人工クモ糸の製造：鋼鉄を超える夢の新素材', summary: '鋼鉄より強くナイロンより柔軟なクモの糸を微生物で大量生産。石油に頼らない超軽量・高強度の未来の素材。', desc: 'クモの糸は同じ太さの鋼鉄より強く、ナイロンよりもしなやかな驚異の繊維です。このクモの糸のタンパク質をコードする遺伝子を微生物に組み込み、人工的にクモ糸を大量生産する「バイオミメティクス」（生物の優れた構造や機能を真似して新しい技術に活かす学問）の研究です。石油資源に頼らず、環境に優しく超軽量で頑丈な未来の飛行機や衣類の素材を作る点が非常に面白いです。将来は化学・繊維メーカーでの新素材開発職や、環境対応製品を手がけるメーカーの研究開発者などの仕事に繋がります。', url: 'https://spiber.inc/' },
            { title: 'デザインと法律の狭間にある建築学', summary: '美しいデザインと耐震基準・都市計画法の制約を両立して空間を設計する。アートと理系計算を融合させた建築の現実。', desc: '建築とは、単に見た目が美しいデザインを描くだけの学問ではありません。地震から人の命を守る「耐震基準」や、街全体の調和を守る「都市計画法」など、厳しい法律や予算、物理的制約の中で最適な空間を設計します。自由なアートの感性と、冷徹な理系の安全計算を高いレベルで両立させ、人々の生活空間を創り出すプロセスが非常に面白いです。将来は一級建築士としてデザイン事務所で働くほか、ハウスメーカーでの意匠設計者、都市計画を主導する自治体の公務員などの仕事に繋がります。', url: 'https://www.aij.or.jp/' }
        ]},
        info_data: { label: '情報・データ', articles: [
            { title: '自動運転を支える統計と計算', summary: 'カメラ映像をベイズ統計で確率処理し、安全なルートを瞬時に判断するAI。高度な数学が物理的な動きに変換される瞬間。', desc: 'AIを搭載した車がカメラやセンサー情報から歩行者や障害物を検知し、安全なルートを瞬時に判断して走る自動運転技術です。その裏側では、カメラ映像がブレた際などに周囲の状況を「確率」で推測する高度なベイズ統計や行列の計算が行われています。ただのプログラミングではなく、高度な数学の力を現実の物理的な動きに変換する点が非常に面白いです。将来は自動車メーカーの自動運転システム開発エンジニアや、AI開発ベンチャーのアルゴリズムエンジニアなどの仕事に繋がります。', url: 'https://www.aist.go.jp/' },
            { title: 'あなたへのおすすめ動画の秘密：レコメンド技術', summary: '数百万人の行動履歴を行列データとして処理し、あなたの「次に見たい動画」を先読みするアルゴリズムの巧妙な仕組み。', desc: 'SNSや動画サイトで「あなたが次に見たくなる動画」を先回りして表示する、レコメンド（おすすめ）システムのアルゴリズム研究です。ユーザーの過去のクリック履歴や視聴時間を巨大な「行列データ」として統計的に処理し、個人の見えない好みや感情の動きを数式でモデル化します。数百万人の人間の行動傾向から正確に次の動きを予測する知的な仕組みが非常に面白いです。将来はIT企業のデータアナリストや、AI開発を行うソフトウェアエンジニア、データサイエンティストなどの仕事に繋がります。', url: 'https://www.ipsj.or.jp/' },
            { title: '脳と機械をつなぐブレイン・マシン・インターフェース', summary: '頭の中で考えるだけでロボットを操作。脳波をリアルタイム解析してコンピュータのコマンドに変換するSF的な最先端技術。', desc: '頭の中で「右へ動け」と考えるだけでロボットアームを動かしたり、画面上の文字を入力したりする技術です。脳から発生する微弱な「脳波」（頭皮から測定できる脳活動の電気信号）をリアルタイムで解析し、コンピュータが理解できるコマンドに変換します。人間の意志を身体を通さずに直接デジタル世界に繋げるというSFのような未来を実現する点が非常に面白いです。将来は医療機器メーカーの研究開発員や、最先端のウェアラブルデバイスを設計するプロダクトデザイナーなどの仕事に繋がります。', url: 'https://www.nips.ac.jp/' }
        ]},
        agri_bio: { label: '農学・生命', articles: [
            { title: 'ホタルのDNA研究と、生物発光', summary: 'ホタルはなぜ光る？発光遺伝子をデータベース化し、発光酵素の未解明メカニズムを分子生物学で解き明かす中部大学の研究。', desc: '生きものが光る不思議に迫るのが、中部大学の発光生物学研究室です。ここでは、光る生きものの遺伝子情報を集めてライブラリー（データベース）化する「DNAバーコーディング」や、発光基質（光る物質）である「ルシフェリン」、発光酵素（光るのを助ける物質）の「ルシフェラーゼ」が未解明な生きものの発光メカニズム、そして進化の謎を、分子生物学的・生理学的なアプローチで研究しています。自分たちで見つけた生きものを使い、なぜ光るのかというシンプルな好奇心を徹底探求できる点が非常に面白い研究です。', url: 'https://pfs.chubu.ac.jp/faculty/oba-yuichi/' },
            { title: '砂漠でも育つ？塩水に強い「スーパー作物」の開発', summary: '海水を含む土壌でも枯れないイネやトマトをゲノム編集で開発。砂漠化が進む地球で食料危機を解決するダイナミックな挑戦。', desc: '地球温暖化や砂漠化が進む中、真水ではなく海水を含んだ「しょっぱい土」でも枯れずに育つトマトやイネを開発する研究です。植物が塩分のストレスを和らげる「耐塩性遺伝子」を特定し、ゲノム編集（設計図である遺伝子を狙い通りに書き換える技術）を用いて過酷な環境で育つ植物を造り出します。世界中の干ばつや砂漠地帯を緑の農地に変え、食料危機を解決するダイナミックさが非常に面白いです。将来は食品・種苗メーカーの研究開発職や、国際協力機構（JICA）などの農業技術支援員などの仕事に繋がります。', url: 'https://jspp.org/' },
            { title: '昆虫食の栄養と安全性：虫を食べて世界を救う', summary: '牛肉より環境負荷が極めて低い高タンパクなコオロギ食。その安全性・加工法・味を科学的に分析し未来の食卓をデザインする。', desc: 'コオロギやイモムシなどを、安全かつ美味しく食べるための科学的研究です。昆虫は、従来の牛肉や豚肉に比べて「温室効果ガスの排出量が極めて少なく」、水やエサも少量で済む環境に優しい高タンパク源（代替タンパク質）として世界中から注目されています。ゲテモノとしての見方を変え、安全な加工処理や味の分析を行って「未来の食卓」をデザインする点が非常に面白いです。将来は食品メーカーの新規食材開発者や、農林水産関連の国の研究機関の研究員などの仕事に繋がります。', url: 'https://www.maff.go.jp/' }
        ]},
        medical: { label: '医学・医療', articles: [
            { title: 'iPS細胞によるミニ臓器（オルガノイド）の作成と病気解明', summary: 'iPS細胞から試験管内で本物そっくりの立体的なミニ臓器を育てる技術。人体を傷つけず病気の進行をリアルタイムで観察できる。', desc: 'あらゆる細胞になれるiPS細胞から、本物の人間の臓器そっくりの立体的なミニチュア「オルガノイド」を試験管の中で育てる研究です。これにより、これまで難しかった「人間の脳や心臓がどのように病気になっていくか」をリアルタイムで観察したり、新薬を安全に試したりすることができます。人体を傷つけることなく、精巧なミクロの生命現象を目の前で再現し観察できる点が非常に面白いです。将来は病院の医師として治療にあたるほか、大学病院の再生医療研究員、製薬会社の新薬開発リーダーなどの仕事に繋がります。', url: 'https://www.cira.kyoto-u.ac.jp/' },
            { title: 'がん細胞の「兵糧攻め」：血管新生阻害療法', summary: 'がんが栄養補給用に伸ばす専用血管の形成を邪魔してがんを飢え死にさせる治療法。がん細胞への直接攻撃とは異なる革新的アプローチ。', desc: 'がん細胞は急激に成長するために、周囲から酸素や栄養を奪うための新しい専用の血管を伸ばします。この「血管新生」（既存の血管から新しい血管が伸びて形成される現象）を邪魔し、がんを栄養不足にして飢え死にさせる革新的な治療の研究です。がん細胞そのものを攻撃するのではなく、がんが生きていく「環境」を封鎖して身体に優しく治すというアプローチが非常に面白いです。将来はがん治療の専門医や、がん研究センターなどの研究機関の研究員、外資系製薬会社の新薬プロジェクトメンバーなどの仕事に繋がります。', url: 'https://www.ncc.go.jp/ja/' },
            { title: '腸内細菌と心の関係：脳腸相関（のうちょうそうかん）', summary: '腸内の100兆個の細菌が自律神経を介して脳の働きや気分に影響する驚くべき双方向システム。腸を整えることが心の病気の治療に？', desc: 'お腹の中に住む100兆個以上もの腸内細菌が、自律神経やホルモンを介して私たちの「脳の働き」や「気分の変化（うつ病など）」にまで大きな影響を及ぼしている現象「脳腸相関」の研究です。お腹の健康状態が、頭の思考や心の状態と深く繋がっているという意外な双方向システムを解き明かします。食べ物や腸内フローラ（腸内細菌の集まり）を改善することで心の病気を治療できるかもしれないという点が非常に面白いです。将来は精神科医や、カウンセラー、乳酸菌飲料などを手がける大手食品メーカーの研究開発員などの仕事に繋がります。', url: 'https://jslab.jp/' }
        ]},
        sports_health: { label: '薬学・健康', articles: [
            { title: '狙った場所にだけ薬を届ける「ドラッグデリバリーシステム (DDS)」', summary: 'がん細胞だけにピンポイントで薬を届けるナノカプセル技術。副作用を最小化しながら効果を最大化する精密な製剤設計。', desc: '薬が体中の健康な細胞にまで届いて副作用を起こすのを防ぐため、病気のある「がん細胞などの標的」にだけピンポイントで薬を届けて機能させる「ドラッグデリバリーシステム（DDS）」の研究です。薬をナノメートルサイズの極小カプセルに包み、狙った場所の温度や酸性度に反応して中身を放出する精密な設計を行います。工学や化学を応用して、薬の効き目を最大化し副作用をゼロにする製剤設計が非常に面白いです。将来は製薬会社での製剤研究者や、医療機関の薬剤師、バイオベンチャーの技術者などの仕事に繋がります。', url: 'https://www.dds-society.jp/' },
            { title: 'AIが数日で見つける？次世代の「AI創薬」', summary: '10年・数千億円かかる新薬開発にAIを導入。何億通りの化合物から特効薬候補を数日でシミュレーションする製薬の革命。', desc: 'これまで新しい薬を1つ開発するためには、10年以上の歳月と数千億円の膨大なコストがかかっていました。この創薬プロセスにAI（人工知能）を取り入れ、何億通りもの化学物質の組み合わせから「特定の病気の標的にピタッとはまる化合物」をシミュレーションで一瞬にして見つけ出す研究です。最先端の機械学習によって難病の特効薬候補を劇的スピードで設計する点が非常に面白いです。将来は大手製薬会社の創薬エンジニアや、バイオインフォマティクス（情報生命科学）の研究者などの仕事に繋がります。', url: 'https://www.pharm.or.jp/' },
            { title: '薬の飲み合わせの謎を解く「薬物相互作用」', summary: 'グレープフルーツと一緒に飲むと薬が危険になる理由とは。代謝酵素の働きを解明し、安全な処方を科学的に導き出す薬学研究。', desc: '複数の薬を一緒に飲んだり、グレープフルーツジュースなどの特定の食品と一緒に摂取したときに、薬の効果が異常に強まったり消えたりしてしまう「薬物相互作用」の研究です。体内で薬を分解する「代謝酵素」の働きが、他の成分によって邪魔されたり促進されたりするミクロの化学反応を解き明かします。患者さんが安全に治療を受けられるよう、薬理学のデータから危険な組み合わせを事前に予測する点が非常に面白いです。将来は病院や調剤薬局で安全な指導を行う専門薬剤師や、製薬会社の臨床開発・安全性評価員などの仕事に繋がります。', url: 'https://www.pharm.or.jp/' }
        ]},
        education: { label: '教育', articles: [
            { title: 'ゲームの仕組みで学習意欲を高める「ゲーミフィケーション」', summary: 'RPGの「レベルアップ」を授業に応用。「やらされる勉強」を「挑戦したい学び」に変えるアクティブラーニングの教育設計。', desc: 'ロールプレイングゲームの「レベルアップ」「クエスト攻略」「バッジ獲得」といった、人間が思わず熱中してしまう仕組みを、算数や英語などの勉強・授業プランに応用する教育研究です。「勉強させられる」という受動的な態度から、「もっと知りたいから挑戦する」という自発的な学び（アクティブラーニング）へ引き出す授業デザインが非常に面白いです。将来は小学校や中学校・高校の教員として新しい教育を実践するほか、教育系IT企業での教育ゲーム・教材プランナーなどの仕事に繋がります。', url: 'https://www.jset.gr.jp/' },
            { title: '「デジタル教科書」と紙の教科書の脳科学的比較', summary: 'タブレットと紙、記憶定着率が高いのはどっち？脳波測定データでICT教育の効果を科学的に検証する最新の教育工学研究。', desc: 'タブレットPCを使った学習と、従来の紙の教科書を使った学習で、脳の働き（記憶の定着率や集中している度合い）がどう変わるのかを脳波測定やテストデータを用いて比較分析する研究です。ICT教育（情報通信技術を用いた教育）が急速に進む教育現場で、デジタルと紙のそれぞれの良さ（メディア特性）を活かした最適な教育法を科学的に突き止める点が非常に面白いです。将来は教育委員会での学習環境プランナーや、学校の教員、デジタル教材を制作するIT企業のエンジニアなどの仕事に繋がります。', url: 'https://www.mext.go.jp/' },
            { title: '不登校と多様な学びの選択肢：フリースクールの役割', summary: '学校という枠にとらわれない個人のペースに合わせた「オルタナティブ教育」のあり方を設計し、学びの居場所を守る研究。', desc: '不登校の子供たちが増加する中、学校という既存の枠組みにとらわれず、フリースクールやオンライン授業といった多様な環境で子供たちが主体的に学ぶ方法を研究する分野です。一律の集団指導ではなく、個人のペースに合わせた「オルタナティブ教育」（伝統的な学校とは異なる新しい教育システム）のあり方を設計します。一人ひとりの心に寄り添い、その子が社会と繋がる「学びの居場所」をデザインする点が非常に面白いです。将来はスクールカウンセラーや、フリースクールの設立・運営者、地域の教育相談員などの仕事に繋がります。', url: 'https://www.mext.go.jp/' }
        ]},
        business: { label: '経済・法学', articles: [
            { title: 'スマホゲームのガチャにハマる行動経済学', summary: '「あと1回だけ」と課金してしまう非合理な人間心理をデータで解明。プロスペクト理論でより良い社会の行動誘導（ナッジ）を設計する。', desc: '人間が「あと1回だけガチャを引けば絶対にレアキャラが当たるはず」などと、非合理にお金を使ってしまう心理を実験やデータから解き明かす「行動経済学」の研究です。従来の「人間は常に合理的に得する選択をする」という経済学の仮定を破り、実際の不完全な人間心理（プロスペクト理論など）をモデル化します。人間の不合理な選択のクセを突き止め、より良い社会の行動誘導（ナッジ）に活かす点が非常に面白いです。将来は企業のマーケティングディレクターや、金融機関の企画職、消費者行動を分析するデータアナリストなどの仕事に繋がります。', url: 'http://www.abem.jp/' },
            { title: '自動運転車が事故を起こしたら、責任は誰にある？AIと法律', summary: '乗客・メーカー・プログラマー、誰が責任を取るのか。急速に進化する技術に対し法律の解釈を作り直す現代の法学最前線。', desc: 'AIを搭載した完全自動運転車が事故を起こして歩行者をはねてしまったとき、責任を取るべきなのは運転席にいた人か、車を作ったメーカーか、それともAIのプログラマーなのかを追求する法学の研究です。技術の急速な進化に対し、これまでの法律（製造物責任法や民法）をどのように新しく解釈し直すべきかという現代の法秩序のルール作りを考える点が非常に面白いです。将来は弁護士や裁判官といった法曹三者や、企業の法務部門での法務専門スタッフ、交通政策を企画する公務員などの仕事に繋がります。', url: 'https://www.cao.go.jp/' },
            { title: 'チケットの高額転売を防ぐ「マーケットデザイン」', summary: 'ゲーム理論を使って転売屋を防ぎ、欲しい人に確実に届く分配システムを数学的に設計する。全員が幸せになる市場のルール作り。', desc: 'ライブのチケットや臓器移植のドナー探しなど、「高値で売ればいい」だけでは社会的不平等や不公平が生じる市場において、全員がハッピーになる最適なルールを数学的に設計する「マーケットデザイン」の研究です。ゲーム理論（相手の行動を予測して自分の戦略を決める理論）を用いて、転売を防止しつつ欲しい人に確実に行き渡る分配システムを設計する点が非常に面白いです。将来はIT企業のプラットフォーム設計者や、国の政策立案者、オークション制度を設計する経済コンサルタントなどの仕事に繋がります。', url: 'http://www.jeaweb.org/' }
        ]},
        humanities: { label: '文学・人文', articles: [
            { title: 'メタバースやAI時代の「心」を考える哲学・倫理学', summary: 'AIに自己意識が宿ったら人権を認めるべき？仮想空間の体験は現実と同じ価値を持つのか。テクノロジーと人間の関係を深く問い直す哲学。', desc: '「もしAIが高度な感情や自己意識を持ったら、人権を認めるべきなのか？」「仮想空間（メタバース）での体験やアイデンティティは、現実の自分と同じ価値を持つのか？」という、テクノロジーと人間の関係を考える新しい哲学・倫理学の研究です。科学の進歩がもたらす新しい社会の中で、私たちがどう生きるべきか、倫理的な基準（AI倫理）を深く問い直す点が非常に面白いです。将来は企業のAI倫理コンサルタントや、公務員、大学の哲学者、高校の倫理教員などの仕事に繋がります。', url: 'http://philosophy-japan.org/' },
            { title: '消えゆく地方の「方言」を保存する社会言語学', summary: '過疎化で失われつつある方言を録音・データ化し言語地図を作成。言葉の変化から土地の歴史や文化のルーツを解き明かす研究。', desc: '過疎化や標準語の普及によって失われつつある地方の方言を、現地で録音してデータ化し、言葉の地域的な違いを地図上にマッピングする「言語地図」作成や社会言語学の研究です。言葉のわずかな変化から、その土地の歴史や文化、人々のコミュニティの結びつきのルーツを学問的に解き明かす点が非常に面白いです。将来は中学校・高校の国語教員や、地域の歴史や文化財を保護する学芸員、言語データの記録・解析を担うソフトウェアエンジニアなどの仕事に繋がります。', url: 'http://www.lsj.gr.jp/' },
            { title: '日本古代の「怨霊（おんりょう）」と怪異の歴史文学', summary: '古事記や源氏物語に描かれた幽霊・生霊の物語から平安時代の人々の恐怖と信仰を読み解く。歴史と文学が交差する意外と熱い研究。', desc: '古事記や源氏物語、説話集に描かれた「幽霊」や「生霊（いきりょう）」などの怪異を通して、平安時代などの昔の人がなぜ怪奇現象を信じ、それがどのように物語として消費されたのかを読み解く文学研究です。昔の人が抱いた「恐怖」や「怒り」といった心の動きを文献から探り、当時の歴史的背景や信仰の構造を明らかにする点が非常に面白いです。将来は国語や古典の教員をはじめ、出版社の編集者、歴史文化を紹介するライター、観光産業のコンテンツプランナーなどの仕事に繋がります。', url: 'http://www.nihonbungaku.or.jp/' }
        ]},
        intl_lang: { label: '社会・国際', articles: [
            { title: 'なぜ「推し活」は人を救うのか？ファンコミュニティの社会学', summary: '推し活が単なる趣味を超えた「生きがい」になる理由。インタビューやアンケートでファンコミュニティが解消する現代の孤独を分析する。', desc: 'アイドルやアニメキャラクターを熱狂的に応援する「推し活」。これが現代社会を生きる人々にとって、単なる趣味を超えてなぜ強い「生きがい」や「自己アイデンティティ（自分らしさ）」の獲得に繋がっているのかを分析する社会学の研究です。インタビューやアンケートを通して、同じ関心を持つ人々が集まる「ファンコミュニティ」が、現代の孤独をどのように解消しているのかを解き明かす点が非常に面白いです。将来は広告代理店の企画職や、エンタメ業界のマーケター、世論調査を行う社会調査士などの仕事に繋がります。', url: 'https://jss-sociology.org/' },
            { title: 'SNSの「フィルターバブル」が引き起こす社会の分断', summary: 'AIアルゴリズムが好みの情報しか表示しなくなると偏った思考が強化され対立が生まれる。情報流通の裏に潜むリスクを科学する。', desc: 'スマホのAIアルゴリズムが、あなたの興味や好みに合う情報ばかりを自動的に表示することで、自分の意見と異なる情報が見えなくなってしまう「フィルターバブル」現象の研究です。自分の「見たいもの」だけが並ぶことで偏った思考が強化され、SNS上で他者との対立や社会の分断がなぜ起きるのかを分析します。インターネット時代の情報流通の裏に潜むリスクを科学的に解き明かす点が非常に面白いです。将来はメディア業界のジャーナリストや、IT企業のSNSアナリスト、コンテンツ設計者などの仕事に繋がります。', url: 'https://www.jsicr.jp/' },
            { title: '都市の中の「見えない居場所」：サードプレイスの研究', summary: '家でも学校でもないカフェや地域スペースが人の心の健康を支える。都市の空間デザインと幸福感・孤独解消の関係を明らかにする研究。', desc: '自宅（第1の場所）でも、学校や職場（第2の場所）でもない、カフェや地域のコミュニティスペースといった心地よく過ごせる「サードプレイス（第3の場所）」が、人々の心の健康や地域の繋がりをどう維持するのかを調べる都市社会学の研究です。都市の空間デザインが、人々の幸福感や孤独感の解消にどのように影響するかという謎を明らかにします。将来は都市計画のデザイナーや、地域のまちづくりを手がけるコンサルタント、不動産企画などの仕事に繋がります。', url: 'http://www.kouryu.or.jp/' }
        ]},
        arts_create: { label: '芸術・創造', articles: [
            { title: 'なぜ有名な絵画は数億円もするの？アート市場の秘密', summary: '作品の美しさだけでなく、歴史的背景や業界専門家による評価・プロデュースが重なって価値が形成されるアート市場の裏側。', desc: 'ゴッホやピカソといった世界的な名画が、なぜ数億円から数百億円もの超高額で取引されるのかという「アート市場の価値基準」を解き明かす芸術学・美術史の研究です。作品の美しさだけでなく、画家が生きた歴史的背景や、絵画がアート業界の専門家によってどう評価・プロデュースされてきたのかという価値形成の裏側を探ります。主観的な「美」に客観的な価値がつく謎を解明するプロセスが非常に面白いです。将来は美術館の学芸員（キュレーター）や、アートディーラー、オークションハウスのスペシャリストなどの仕事に繋がります。', url: 'https://www.tobunken.go.jp/' },
            { title: 'ヒットする音楽に隠された「コード進行」の数学的パターン', summary: '「エモい」と感じさせるヒット曲に共通する和音の並びを音響心理学と統計で解析。感性の音楽を冷徹な科学データで分解する研究。', desc: '人々が「この曲はエモい」「一度聴いたら忘れられない」と感じるヒット曲の裏側に潜む、共通した「コード進行」（和音の並び）の数学的パターンを分析する音楽理論の研究です。なぜ特定の和音の並びが、人間の脳に心地よさや感動、懐かしさを引き起こすのかを、音響心理学や統計分析を用いて明らかにします。感性で聴く音楽を、冷徹な科学データで分解して解明する点が非常に面白いです。将来は作曲家や音楽プロデューサー、ゲーム音楽のクリエイター、音楽配信サービスのアルゴリズム開発者などの仕事に繋がります。', url: 'http://www.musicology-japan.org/' },
            { title: '宇宙旅行時代の法律：「宇宙法」と月資源の所有権', summary: '月で犯罪が起きたらどこの国の法律で裁く？月の資源は誰のもの？宇宙ビジネスの拡大に備えて地球外の法秩序を設計する新分野。', desc: '民間人が気軽に宇宙旅行に行けるようになった未来、宇宙空間や月面で犯罪が起きたらどこの国の法律で裁くべきか、また月で発見された希少な資源は誰の所有物になるのかを議論する「宇宙法」の研究です。どこの国も宇宙を独占してはならないと定める「宇宙条約」をベースに、宇宙ビジネスの拡大に伴う地球外の法秩序を設計します。地球の限界を超えて広がる法律の新たなフロンティアを開拓する点が非常に面白いです。将来は国際機関の宇宙政策アドバイザーや、宇宙ベンチャー企業の法務担当、国際弁護士などの仕事に繋がります。', url: 'https://www.jaxa.jp/' }
        ]}
    };

    function openArticleModal(catLabel, article) {
        document.getElementById('modal-badge').textContent = catLabel;
        document.getElementById('modal-title').textContent = article.title;
        document.getElementById('modal-desc').textContent = article.desc || article.summary;
        document.getElementById('modal-link').href = article.url;
        document.getElementById('article-modal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeArticleModal() {
        document.getElementById('article-modal').classList.remove('open');
        document.body.style.overflow = '';
    }

    document.getElementById('modal-close').addEventListener('click', closeArticleModal);
    document.getElementById('article-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeArticleModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticleModal();
            closeAuthModal();
        }
    });

    function renderArticleList(filter) {
        const grid = document.getElementById('articles-full-grid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.entries(articleIndex).forEach(([key, cat]) => {
            if (filter !== 'all' && filter !== key) return;
            cat.articles.forEach(article => {
                const isSaved = savedArticleUrls.has(article.url);
                const card = document.createElement('div');
                card.className = 'article-list-card glass-panel';
                card.innerHTML = `
                    <span class="badge">${cat.label}</span>
                    <h4>${article.title}</h4>
                    <p class="article-summary">${article.summary}</p>
                    <div class="card-actions">
                        <span class="article-read-more">続きを読む →</span>
                        <button class="save-article-btn${isSaved ? ' saved' : ''}">${isSaved ? '✓ 保存済み' : '＋ 保存する'}</button>
                    </div>
                `;
                const saveBtn = card.querySelector('.save-article-btn');
                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('save-article-btn')) {
                        openArticleModal(cat.label, article);
                    }
                });
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSaveArticle(saveBtn, key, cat.label, article);
                });
                grid.appendChild(card);
            });
        });
    }

    const filterContainer = document.getElementById('filter-buttons');
    if (filterContainer) {
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.textContent = 'すべて';
        allBtn.dataset.filter = 'all';
        filterContainer.appendChild(allBtn);

        Object.entries(articleIndex).forEach(([key, cat]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = cat.label;
            btn.dataset.filter = key;
            filterContainer.appendChild(btn);
        });

        filterContainer.addEventListener('click', (e) => {
            if (!e.target.classList.contains('filter-btn')) return;
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderArticleList(currentFilter);
        });

        renderArticleList('all');
    }
});
