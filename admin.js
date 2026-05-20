// =======================
// Supabase 初始化
// =======================
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
// ⚠️ 注意：sb_publishable_ 开头的是 anon 公开 Key，仅用于前端只读/匿名写入
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);



const sb =
    window.supabase.createClient(
        supabaseUrl,
        supabaseKey
    );

// =======================
// 登录
// =======================

window.login = function(){

    const pwd =
        document.getElementById('adminPassword').value;

    if(pwd === '123456'){

        document.getElementById('loginBox')
            .style.display = 'none';

        document.getElementById('adminPanel')
            .style.display = 'block';

        loadResults();

    }else{

        alert('密码错误');

    }

};

// =======================
// 加载数据
// =======================

async function loadResults(){

    try{

        // candidates

        const candidateRes =
            await sb
                .from('candidates')
                .select('*')
                .order('position',{ascending:true});

        if(candidateRes.error){

            console.error(candidateRes.error);

            alert('读取 candidates 失败');

            return;
        }

        const candidates =
            candidateRes.data || [];

        // votes

        const voteRes =
            await sb
                .from('votes')
                .select('*');

        if(voteRes.error){

            console.error(voteRes.error);

            alert('读取 votes 失败');

            return;
        }

        const votes =
            voteRes.data || [];

        // =====================
        // 统计票数
        // =====================

        const voteMap = {};

        votes.forEach(v => {

            if(!voteMap[v.candidate_id]){

                voteMap[v.candidate_id] = 0;

            }

            voteMap[v.candidate_id]++;

        });

        // =====================
        // 投票人数
        // =====================

        const uniqueCodes =
            new Set();

        votes.forEach(v => {

            if(v.code){

                uniqueCodes.add(v.code);

            }

        });

        const votedUsers =
            uniqueCodes.size;

        document.getElementById('votedUsers')
            .innerText = votedUsers;

        // =====================
        // 参与率
        // =====================

        const totalPeople =
            parseInt(
                document.getElementById('totalPeople').value
            ) || 0;

        const joinRate =
            totalPeople > 0
            ? ((votedUsers / totalPeople) * 100).toFixed(1)
            : 0;

        document.getElementById('joinRate')
            .innerText = joinRate + '%';

        // =====================
        // 分组
        // =====================

        const positionMap = {};

        candidates.forEach(c => {

            if(!positionMap[c.position]){

                positionMap[c.position] = [];

            }

            const count =
                voteMap[c.id] || 0;

            const rate =
                votedUsers > 0
                ? ((count / votedUsers) * 100).toFixed(1)
                : 0;

            positionMap[c.position].push({

                ...c,

                votes:count,

                rate:rate

            });

        });

        // =====================
        // 排序
        // =====================

        Object.keys(positionMap).forEach(position => {

            positionMap[position]
                .sort((a,b)=>b.votes-a.votes);

        });

        // =====================
        // 渲染
        // =====================

        const container =
            document.getElementById('resultsContainer');

        container.innerHTML = '';

        Object.keys(positionMap).forEach(position => {

            const section =
                document.createElement('div');

            section.className =
                'position-section';

            let html = `
                <div class="position-title">
                    ${position}
                </div>

                <div class="candidate-list">
            `;

            positionMap[position].forEach(c => {

                const color =
                    parseFloat(c.rate) >= 50
                    ? '#16a34a'
                    : '#dc2626';

                html += `
                    <div class="candidate-card">

                        <div class="candidate-name">
                            ${c.name}
                        </div>

                        <div class="candidate-votes">
                            ${c.votes}票
                        </div>

                        <div
                            class="candidate-rate"
                            style="color:${color}"
                        >
                            ${c.rate}%
                        </div>

                    </div>
                `;

            });

            html += '</div>';

            section.innerHTML = html;

            container.appendChild(section);

        });

    }catch(err){

        console.error(err);

        alert('后台加载失败');

    }

}

// =======================
// 刷新
// =======================

window.refreshResults = function(){

    loadResults();

};

// =======================
// 复位投票
// =======================

window.resetVotes = async function(){

    const confirm1 =
        confirm('确定清空全部投票？');

    if(!confirm1) return;

    const confirm2 =
        confirm('此操作不可恢复');

    if(!confirm2) return;

    try{

        // 删除 votes

        const deleteRes =
            await sb
                .from('votes')
                .delete()
                .neq('id',0);

        if(deleteRes.error){

            console.error(deleteRes.error);

            alert('删除 votes 失败');

            return;
        }

        // 重置 codes

        const updateRes =
            await sb
                .from('codes')
                .update({
                    used:false
                })
                .neq('id',0);

        if(updateRes.error){

            console.error(updateRes.error);

            alert('重置 codes 失败');

            return;
        }

        alert('复位成功');

        loadResults();

    }catch(err){

        console.error(err);

        alert('复位失败');

    }

};