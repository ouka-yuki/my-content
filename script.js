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

    // 診断ロジック
    const questions = document.querySelectorAll('.question-block');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('quiz-form');
    const resultArea = document.getElementById('result-area');
    const retryBtn = document.getElementById('retry-btn');
    
    let currentQuestion = 0;

    function updateControls() {
        questions.forEach((q, index) => {
            q.classList.toggle('active', index === currentQuestion);
        });

        prevBtn.style.display = currentQuestion > 0 ? 'inline-block' : 'none';
        
        // Q10 (現在のindex 8) で「いいえ」を選んでいる場合、次へボタンを非表示にして結果を見るボタンにする
        const isQ10No = currentQuestion === 8 && document.querySelector('input[name="q10"]:checked')?.value === 'no';

        if (currentQuestion === questions.length - 1 || isQ10No) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        }
    }

    form.addEventListener('change', (e) => {
        if (e.target.name === 'q8') {
            const checkedBoxes = document.querySelectorAll('input[name="q8"]:checked');
            if (checkedBoxes.length > 3) {
                e.target.checked = false;
                alert('選択できるのは最大3つまでです。');
            }
        }
        updateControls();
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
            updateControls();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentQuestion > 0) {
            currentQuestion--;
            updateControls();
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const q1 = formData.get('q1');
        const q2 = formData.get('q2');
        const q3 = formData.get('q3');
        const q4 = formData.get('q4');
        const q5 = formData.get('q5');
        const q6 = formData.get('q6');
        const q7 = formData.get('q7');
        const q8 = formData.getAll('q8');
        const q10 = formData.get('q10');
        const q11 = formData.get('q11');

        // Q10が'yes'の場合はQ11の回答も必須
        if (!q1 || !q2 || !q3 || !q4 || !q5 || !q6 || !q7 || q8.length === 0 || !q10 || (q10 === 'yes' && !q11)) {
            alert('すべての質問に答えてください。');
            return;
        }

        calculateResult(q1, q2, q3, q4, q5, q6, q7, q8, q10, q11);
    });

    retryBtn.addEventListener('click', () => {
        form.reset();
        currentQuestion = 0;
        updateControls();
        resultArea.classList.add('hidden');
        form.style.display = 'block';
    });

    function calculateResult(q1, q2, q3, q4, q5, q6, q7, q8, q10, q11) {
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

        // Q1: 学習スタイル（認知特性）
        if (q1 === 'abstract') {
            scores.sci_math += 3; scores.humanities += 2; scores.info_data += 2;
        } else if (q1 === 'concrete') {
            scores.engineering += 3; scores.medical += 2; scores.business += 1; scores.agri_bio += 2; scores.sports_health += 2;
        }

        // Q2: 認知特性2（システム vs 人間）
        if (q2 === 'systematic') {
            scores.sci_math += 2; scores.engineering += 2; scores.info_data += 3; scores.business += 1;
        } else if (q2 === 'humanistic') {
            scores.humanities += 2; scores.education += 2; scores.medical += 2; scores.intl_lang += 2; scores.arts_create += 1;
        }

        // Q3: 動機のタイプ
        if (q3 === 'intrinsic') {
            scores.sci_math += 2; scores.humanities += 2; scores.arts_create += 3; scores.agri_bio += 1; scores.education += 1;
        } else if (q3 === 'extrinsic') {
            scores.business += 3; scores.medical += 2; scores.engineering += 1; scores.info_data += 1;
        }

        // Q4: 開放性
        if (q4 === 'high_open') {
            scores.intl_lang += 3; scores.arts_create += 2; scores.info_data += 2; scores.sci_math += 1; scores.humanities += 1;
        } else if (q4 === 'low_open') {
            scores.business += 2; scores.medical += 2; scores.engineering += 1; scores.education += 1;
        }

        // Q5: 誠実性
        if (q5 === 'high_consc') {
            scores.medical += 3; scores.business += 2; scores.education += 2; scores.agri_bio += 1;
        } else if (q5 === 'low_consc') {
            scores.arts_create += 2; scores.info_data += 1; scores.humanities += 1; scores.intl_lang += 1;
        }

        // Q6: 外向性・共感性
        if (q6 === 'high_extra') {
            scores.education += 3; scores.intl_lang += 3; scores.sports_health += 3; scores.business += 1; scores.medical += 2;
        } else if (q6 === 'introverted') {
            scores.sci_math += 3; scores.info_data += 3; scores.humanities += 2; scores.arts_create += 2;
        }

        // RIASEC処理関数
        function processRIASEC(val) {
            if (val === 'R') { scores.engineering += 2; scores.agri_bio += 2; scores.sports_health += 2; }
            else if (val === 'I') { scores.sci_math += 3; scores.info_data += 2; scores.medical += 1; }
            else if (val === 'A') { scores.arts_create += 3; scores.humanities += 2; scores.intl_lang += 1; }
            else if (val === 'S') { scores.education += 3; scores.medical += 2; scores.sports_health += 1; }
            else if (val === 'E') { scores.business += 3; scores.intl_lang += 1; }
            else if (val === 'C') { scores.business += 2; scores.info_data += 1; scores.engineering += 1; }
        }

        // Q7: RIASEC (残す)
        processRIASEC(q7);

        // Q8: テーマ複数選択 (最大3つ)
        q8.forEach(val => {
            if (val === 'sci1') { scores.sci_math += 3; }
            else if (val === 'sci2') { scores.sci_math += 2; scores.info_data += 2; }
            else if (val === 'sci3') { scores.info_data += 3; scores.engineering += 1; }
            else if (val === 'sci4') { scores.engineering += 3; }
            else if (val === 'sci5') { scores.engineering += 2; scores.agri_bio += 1; scores.sci_math += 1; }
            else if (val === 'sci6') { scores.agri_bio += 3; scores.medical += 1; }
            else if (val === 'sci7') { scores.agri_bio += 2; scores.sci_math += 1; }
            else if (val === 'sci8') { scores.medical += 3; scores.sports_health += 1; }
            else if (val === 'hum1') { scores.education += 2; scores.humanities += 1; scores.medical += 1; }
            else if (val === 'hum2') { scores.humanities += 3; }
            else if (val === 'hum3') { scores.humanities += 1; scores.intl_lang += 3; }
            else if (val === 'hum4') { scores.arts_create += 3; }
            else if (val === 'hum5') { scores.business += 3; }
            else if (val === 'hum6') { scores.business += 2; scores.intl_lang += 1; }
            else if (val === 'hum7') { scores.education += 3; }
            else if (val === 'hum8') { scores.sports_health += 3; }
        });

        // Q10 & Q11: 現実的制約
        if (q10 === 'yes' && q11) {
            if (q11 === 'high_invest') {
                scores.medical += 4; scores.sci_math += 3; scores.agri_bio += 2;
            } else if (q11 === 'practical') {
                scores.info_data += 3; scores.engineering += 3; scores.business += 2; scores.sports_health += 2;
            } else if (q11 === 'economic') {
                scores.humanities += 2; scores.education += 2; scores.intl_lang += 2; scores.arts_create += 2;
            }
        }

        // Sort and get TOP 3
        let sortedCategories = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        let top3 = sortedCategories.slice(0, 3);
        displayResult(top3, { q3, q4, q5, q6, q7 });
    }

    function displayResult(top3Categories, traits) {
        const reasonEl = document.getElementById('result-reason');
        const workStyleEl = document.getElementById('work-style-desc');
        const rankingContainer = document.getElementById('ranking-container');

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
                title: '理学部 物理学科 / 数学科 など',
                learn: '宇宙の始まり、素粒子の振る舞い、数学的な証明など、自然界や世界の「なぜ？」を根本から解き明かす学問です。',
                jobs: '大学の研究者、データサイエンティスト、システムエンジニア、中高の理科・数学教員など。',
                articles: [
                    { title: 'スマホはどうやって動いているの？', desc: '実はスマホの中には「量子力学」という、目に見えないミクロな世界の不思議な法則が詰まっています。' },
                    { title: 'ブラックホールの向こう側はどうなっている？', desc: '光さえも吸い込むブラックホール。宇宙物理学や数学を使って、その謎に迫ることができます。' }
                ]
            },
            engineering: {
                title: '工学部 機械工学科 / 建築学科 など',
                learn: 'ロボットの制御、安全で美しい建築物の設計、新しい素材の開発など、科学の知識を応用して「モノ」を作る方法を学びます。',
                jobs: 'メーカーの製品開発職、建築士、プラントエンジニアなど。',
                articles: [
                    { title: '絶対に壊れない橋はどう作る？', desc: '物理の力学と最新の素材計算を使って、台風や地震でもびくともしない構造を設計する秘密に迫ります。' },
                    { title: 'ロボットは人間を超えられる？', desc: 'しなやかな動きや繊細な力加減を実現する、最先端の機械工学の仕組みを紹介します。' }
                ]
            },
            info_data: {
                title: '情報学部 / データサイエンス学部 など',
                learn: 'AIのアルゴリズム、プログラミング、膨大なデータから社会のトレンドを読み解く統計解析の手法などを学びます。',
                jobs: 'ITエンジニア、データアナリスト、AI開発者、Webデザイナーなど。',
                articles: [
                    { title: '自動運転車はなぜぶつからない？', desc: 'カメラやセンサーから得た膨大な情報をAIが一瞬で計算し、安全なルートを判断する仕組みを学びます。' },
                    { title: 'あなたへのおすすめ動画はどう決まる？', desc: 'YouTubeやTikTokの裏側で動いている、あなたの好みを予測するレコメンドエンジンの秘密。' }
                ]
            },
            agri_bio: {
                title: '農学部 / バイオ・生命科学部 など',
                learn: '動植物の生態、遺伝子操作による品種改良、環境問題の解決策など、生命と自然に関する科学を学びます。',
                jobs: '食品メーカーの開発職、農業技術者、環境コンサルタント、バイオ研究者など。',
                articles: [
                    { title: '枯れないトマトはどう作る？', desc: '遺伝子を少し書き換えるだけで、病気に強くて美味しい野菜を生み出すゲノム編集技術の凄さ。' },
                    { title: '微生物がプラスチックを食べる？', desc: '地球環境を救うかもしれない、不思議な微生物の力を利用した最新のバイオテクノロジー。' }
                ]
            },
            medical: {
                title: '医学部 / 看護学部 / 福祉学部 など',
                learn: '人体の構造や病気のメカニズム、薬の働き、そして心身に障がいを持つ人々を社会全体でどうサポートするかを学びます。',
                jobs: '医師、看護師、薬剤師、理学療法士、ソーシャルワーカーなど。',
                articles: [
                    { title: 'なぜ薬は痛いところだけ効くの？', desc: '体内に入った成分が、細胞の特定の「鍵穴」にだけピタッとはまることで効果を発揮する不思議なメカニズム。' },
                    { title: 'AIが医者を助ける時代？', desc: '何万枚ものレントゲン写真を学習したAIが、人間の目では見逃してしまう小さな病変を瞬時に見つける技術。' }
                ]
            },
            sports_health: {
                title: 'スポーツ科学部 / 健康科学部 など',
                learn: '人間の筋肉や骨の動き、栄養学、スポーツ心理学など、パフォーマンス向上と健康維持のための科学を学びます。',
                jobs: 'スポーツインストラクター、アスレティックトレーナー、体育教師、健康運動指導士など。',
                articles: [
                    { title: 'なぜ一流アスリートは本番に強い？', desc: 'プレッシャーを力に変える「スポーツ心理学」の視点から、メンタルをコントロールする方法を学びます。' },
                    { title: '筋トレで頭も良くなるって本当？', desc: '運動が脳に与える影響や、最も効率的に筋肉を育てるための最新のスポーツ科学。' }
                ]
            },
            education: {
                title: '教育学部 / 心理学部 など',
                learn: '人間の心の発達や感情の仕組み、効果的な学習方法、そして誰もが生きやすい社会のあり方を学びます。',
                jobs: '学校の教員、公認心理師、カウンセラー、人事・人材育成担当など。',
                articles: [
                    { title: 'なぜ人は「限定品」に弱いの？', desc: '「今しか買えない」と言われると欲しくなる。人間の無意識の心の動きや行動パターンを心理学で紐解きます。' },
                    { title: '褒めて伸ばすのは本当に正しい？', desc: '教育学の実験データから、どんな声かけが最も子どものやる気と能力を引き出すのかを科学的に証明します。' }
                ]
            },
            business: {
                title: '経済学部 / 経営学部 / 法学部 など',
                learn: 'お金の流れ（経済）、会社を成功させる戦略（経営）、そして社会のルールを守りトラブルを解決するルール（法律）を学びます。',
                jobs: '企業の総合職、公務員、銀行員、公認会計士、弁護士など。',
                articles: [
                    { title: 'なぜタピオカブームは終わったの？', desc: '商品の流行り廃りの裏には、需要と供給、そして消費者の行動心理という明確な「経済のルール」があります。' },
                    { title: 'SNSの悪口は犯罪になる？', desc: 'どこまでが表現の自由で、どこからが名誉毀損になるのか。身近なトラブルを法律の視点で解決する方法を学びます。' }
                ]
            },
            humanities: {
                title: '文学部 人文学科 / 史学部 など',
                learn: '過去の歴史から人間がどう生きてきたか、言葉や文学が社会にどう影響を与えたか、人間の根本的なあり方を深く考察します。',
                jobs: '出版・メディア編集者、学芸員、教員、図書館司書など。',
                articles: [
                    { title: '「エモい」って言葉はいつからあるの？', desc: '言葉の変化をたどると、その時代の若者が何を感じ、何を大切にしていたかという社会の空気感が見えてきます。' },
                    { title: 'ピラミッドはどうやって作られた？', desc: '古代の文献や遺跡の発掘から、当時の人々の暮らしや驚くべき技術力、さらには権力の秘密を解き明かします。' }
                ]
            },
            intl_lang: {
                title: '外国語学部 / 国際教養学部 / 観光学部 など',
                learn: '異なる言語の習得はもちろん、世界の異文化、国際政治、グローバルな観光産業やビジネスについて学びます。',
                jobs: '外資系企業、航空業界（CAなど）、商社、旅行・ホテル業界、通訳など。',
                articles: [
                    { title: 'なぜ英語は世界共通語になったの？', desc: '言語の歴史と国際政治のパワーバランスから、世界で英語が一番使われている理由を読み解きます。' },
                    { title: '外国人が日本で驚くことランキング', desc: '文化が違うと「常識」も変わる。異文化理解の視点から、コミュニケーションの面白さを探ります。' }
                ]
            },
            arts_create: {
                title: '芸術学部 / 美術学部 / 音楽学部 など',
                learn: '絵画、デザイン、音楽、映像などの表現技術に加え、芸術が社会や人間に与える影響や歴史を学びます。',
                jobs: 'デザイナー、クリエイター、アーティスト、映像制作、広告制作など。',
                articles: [
                    { title: 'なぜ有名な絵画は数億円もするの？', desc: '芸術の価値はどう決まるのか？アート市場の裏側と、作品に込められた歴史的背景を解説します。' },
                    { title: 'ヒットする音楽に隠された「コード進行」', desc: '人が「いい曲だな」と感じる音楽には、実は数学的なパターンの法則が隠されているという秘密。' }
                ]
            }
        };

        // 1位のカテゴリーをベースに総合的な理由を表示
        reasonEl.textContent = reasons[top3Categories[0]];

        // 働き方のテキストを生成
        if (workStyleEl && traits) {
            let wsText = "<strong>【あなたの行動原理】</strong><br>";
            
            if (traits.q3 === 'intrinsic') {
                wsText += "あなたは「自分自身の納得感や内なる好奇心」を原動力（内発的動機）として行動するタイプです。";
            } else {
                wsText += "あなたは「他者からの評価や社会への影響力」をモチベーション（外発的動機）として頑張れるタイプです。";
            }

            if (traits.q6 === 'high_extra') {
                wsText += "また、人と関わりながらワイワイと進めることでエネルギーを得るため、";
            } else {
                wsText += "また、一人の時間を大切にし、深く思考することでエネルギーを得るため、";
            }

            if (traits.q4 === 'high_open') {
                wsText += "変化の多い環境や新しいことへの挑戦を好みます。<br><br>";
            } else {
                wsText += "決まったルーティンや安定した環境の中で着実に物事を進めるのを好みます。<br><br>";
            }

            wsText += "<strong>【向いている仕事・環境】</strong><br>";
            if (traits.q6 === 'introverted' && traits.q3 === 'intrinsic') {
                wsText += "一人で黙々と深く探求できる「研究職」や「専門職（エンジニア・クリエイターなど）」が非常に向いています。自分のペースで納得いくまでクオリティを高められる環境で最大のパフォーマンスを発揮します。";
            } else if (traits.q6 === 'high_extra' && traits.q3 === 'extrinsic') {
                wsText += "チームを引っ張ったり、多くの人と関わりながら成果を上げる「企画職」「営業職」「マネジメント職」などに適性があります。他者からの感謝や目に見える評価がダイレクトに返ってくる環境で輝きます。";
            } else if (traits.q6 === 'high_extra' && traits.q3 === 'intrinsic') {
                wsText += "人と関わることは好きですが、評価よりも「相手の役に立ったか」「良いものを作れたか」を重視します。「教育関連」「医療・福祉」「対人サポート職」など、他者の成長やケアに直接関わる仕事に向いています。";
            } else if (traits.q6 === 'introverted' && traits.q3 === 'extrinsic') {
                wsText += "一人で集中して作業しつつも、その結果が社会にどう影響を与えるかを重視します。「データアナリスト」「財務・会計」「Webマーケティング」など、専門スキルを用いて組織や社会に確かな貢献をする仕事が合っています。";
            }

            if (traits.q5 === 'high_consc') {
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
                </div>
            `).join('');

            rankBlock.innerHTML = `
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
                <div class="ranking-section">
                    <h6>🔍 興味のタネ（面白いトピック）</h6>
                    <div class="articles-container">
                        ${articlesHtml}
                    </div>
                </div>
            `;
            rankingContainer.appendChild(rankBlock);
        });

        form.style.display = 'none';
        resultArea.classList.remove('hidden');
        
        // 結果エリアへスクロール
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
