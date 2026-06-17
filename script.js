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
                title: '理学部 物理学科 / 数学科 など',
                learn: '宇宙の始まり、素粒子の振る舞い、数学的な証明など、自然界や世界の「なぜ？」を根本から解き明かす学問です。',
                jobs: '大学の研究者、データサイエンティスト、システムエンジニア、中高の理科・数学教員など。',
                articles: [
                    { title: 'スマホの裏にあるミクロの物理法則', desc: 'スマホを動かす半導体には「量子力学」というミクロな世界の物理法則が使われています。理論物理では極めて難解な数式を操る必要があり、「数式が嫌いだけど物理の不思議さに惹かれる」という人は、数式だらけの講義に圧倒されるギャップがあります。' },
                    { title: 'ブラックホールの謎に迫る計算', desc: '光すら吸い込むブラックホールは、アインシュタインの相対性理論などを駆使して解明します。実験はなく、ひたすら紙とペン、コンピュータで数式を追うため、地道に机に向かう抽象的な作業が苦手な人には退屈に感じるかもしれません。' },
                    { title: '大学の数学は「論理の証明」', desc: '大学数学は高校までの「計算ゲーム」とは全く異なり、概念を厳密に証明する「哲学」に近いです。「高校での暗記や計算が得意だったから」という理由だけで入ると、抽象的な数理論理の議論に戸惑うミスマッチが起きやすいです。' },
                    { title: '地道で泥臭い実験物理の世界', desc: 'ノーベル賞級の発見を支える実験物理は、巨大な装置を手作りしたり、数ヶ月に及ぶ測定エラーと戦うなど極めて泥臭いです。スマートな頭脳戦だけを期待すると現実の泥臭さに挫折しがちですが、未知の現象を世界で最初に目撃する感動があります。' }
                ]
            },
            engineering: {
                title: '工学部 機械工学科 / 建築学科 など',
                learn: 'ロボットの制御、安全で美しい建築物の設計、新しい素材の開発など、科学の知識を応用して「モノ」を作る方法を学びます。',
                jobs: 'メーカーの製品開発職、建築士、プラントエンジニアなど。',
                articles: [
                    { title: '絶対に壊れない橋の設計', desc: '力学と最新の素材を用いて安全な構造を設計します。華やかなデザインだけでなく、ひたすら建築基準法の読解や地道な構造計算、強度試験を行うため、数学や物理の計算・地味な安全評価業務を避けたい人には辛い分野です。' },
                    { title: 'ロボット制御の裏に潜む数学', desc: 'ロボットの滑らかな動きを作るには、線形代数や微分積分などの数学をプログラムに落とし込みます。「ロボットが好きで触りたい」だけでは、裏側の複雑な数式とプログラミングの壁にぶつかり、実機に触る前に挫折することもあります。' },
                    { title: '新素材開発における実験の日々', desc: '軽くて強い炭素繊維などの新素材開発は、地道な化学合成と失敗の繰り返しです。すぐにかっこいい製品ができるわけではなく、何百回もの単調な実験を安全に重ねる根気がないと、日々の実験生活が痛手になります。' },
                    { title: 'デザインと法律の狭間にある建築', desc: '建築は芸術的な美しさだけでなく、防災基準や都市計画法など「法律と予算」の厳しい制約の中で行われます。自由奔放なアートを描くだけの学問ではなく、泥臭い交渉やルール遵守が求められるギャップがあります。' }
                ]
            },
            info_data: {
                title: '情報学部 / データサイエンス学部 など',
                learn: 'AIのアルゴリズム、プログラミング、膨大なデータから社会のトレンドを読み解く統計解析の手法などを学びます。',
                jobs: 'ITエンジニア、データアナリスト、AI開発者、Webデザイナーなど。',
                articles: [
                    { title: '自動運転を支える統計と計算', desc: 'AIが安全ルートを瞬時に判断する自動運転。その裏側は膨大な確率・統計の計算です。「パソコン操作やガジェットが好き」というだけで入ると、数学理論の壁に圧倒されてしまう最大のギャップが存在します。' },
                    { title: 'あなたへのおすすめ動画の秘密', desc: 'レコメンドエンジンは、行動履歴を高度な数理モデルで分析して好みを予測します。単にアルゴリズムを書くだけでなく、個人情報保護などの倫理的課題も伴うため、数理だけでなく社会科学的な視野も必要になります。' },
                    { title: 'プログラミングは「手段」であって「目的」ではない', desc: '大学の情報学は、コーディング技術ではなく「情報とは何か」という数理的理論を学びます。単に「Webサイトを作りたい、コードを書きたい」だけなら専門学校の方が向いており、大学の難解な論理学の授業に面食らう人も多いです。' },
                    { title: '暗号技術とハッカーの知恵比べ', desc: '情報を守る暗号技術は、素数をベースにした高度な数論に裏打ちされています。映画のような華やかなハッキングのイメージとは異なり、数論やプロトコル規約を徹底的に読み込む几帳面さと数学への深い理解が不可欠です。' }
                ]
            },
            agri_bio: {
                title: '農学部 / バイオ・生命科学部 など',
                learn: '動植物の生態、遺伝子操作による品種改良、環境問題の解決策など、生命と自然に関する科学を学びます。',
                jobs: '食品メーカーの開発職、農業技術者、環境コンサルタント、バイオ研究者など。',
                articles: [
                    { title: 'ゲノム編集による未来の作物', desc: '遺伝子を書き換えて病気に強い野菜を作ります。しかし、バイオテクノロジーは数ヶ月かけて細胞を育てる地道な作業であり、雑菌混入（コンタミ）で一瞬にして実験が台無しになるため、非常に繊細で諦めないメンタルが必要です。' },
                    { title: '微生物の力を借りた環境浄化', desc: '地球を救う微生物の力を探求します。バイオ実験は非常に泥臭く、生き物を相手にするため「週末も培養器の様子を見に研究室に行かなければならない」など、私生活の拘束が非常に厳しいという現実的ギャップがあります。' },
                    { title: '生態系調査フィールドワークの現実', desc: '生態系や森林を学ぶため森や川に入ります。大自然との触れ合いは魅力的ですが、虫や泥、悪天候、肉体労働に耐えるタフさが必要です。「ただ自然を見るのが好き」という観光気分では乗り切れません。' },
                    { title: '「農学」はスマート農業やバイオの科学', desc: '現代の農学はバイオやスマート農業、流通経済まで多岐にわたるサイエンスです。クワを持って土を耕すイメージで入ると、高度な分子生物学や有機化学の講義だらけで驚くかもしれません。' }
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
            // 結果エリアへスクロール
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 1800);
    }
});
