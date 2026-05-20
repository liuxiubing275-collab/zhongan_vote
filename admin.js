// =======================
// Supabase 初始化
// =======================
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
// ⚠️ 注意：sb_publishable_ 开头的是 anon 公开 Key，仅用于前端只读/匿名写入
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);

// =======================
// 登录功能
// =======================
window.login = function () {
  const pwd = document.getElementById('adminPassword').value;
  if (pwd === '123456') {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadResults();
  } else {
    alert('密码错误');
  }
};

// =======================
// 加载投票结果（核心修复）
// =======================
async function loadResults() {
  try {
    console.log('🔄 开始加载数据...');
    
    // 1. 读取候选人（已清理非法空格）
    const candidateRes = await sb
      .from('candidates')
      .select('*')
      .order('position', { ascending: true }); // 修复：去掉 ' position' 前的空格

    if (candidateRes.error) {
      console.error('❌ 读取候选人失败:', candidateRes.error);
      alert(`读取候选人失败：${candidateRes.error.message}`);
      return;
    }

    // 🛡️ 空值防御：确保是数组
    const candidates = Array.isArray(candidateRes.data) ? candidateRes.data : [];

    // 2. 读取 votes
    const voteRes = await sb.from('votes').select('*');
    if (voteRes.error) {
      console.error('❌ 读取投票数据失败:', voteRes.error);
      alert(`读取投票数据失败：${voteRes.error.message}`);
      return;
    }
    const votes = Array.isArray(voteRes.data) ? voteRes.data : [];

    // 3. 统计独立投票人数
    const uniqueCodes = new Set();
    votes.forEach(v => { if (v.code) uniqueCodes.add(v.code); });
    const totalVoteUsers = uniqueCodes.size;

    // 4. 候选人票数统计
    const voteMap = {};
    votes.forEach(v => {
      if (!voteMap[v.candidate_id]) voteMap[v.candidate_id] = 0;
      voteMap[v.candidate_id]++;
    });

    // 5. 按岗位分组
    const positionMap = {};
    candidates.forEach(c => {
      if (!positionMap[c.position]) positionMap[c.position] = [];
      const count = voteMap[c.id] || 0;
      const rate = totalVoteUsers > 0 ? ((count / totalVoteUsers) * 100).toFixed(1) : '0.0';
      positionMap[c.position].push({ ...c, votes: count, rate });
    });

    // 6. 组内按票数降序排序
    Object.keys(positionMap).forEach(pos => {
      positionMap[pos].sort((a, b) => b.votes - a.votes);
    });

    // 7. 渲染到页面（已清理 ID 空格）
    const container = document.getElementById('resultsContainer'); // 修复：去掉 'resultsContai ner' 空格
    if (!container) {
      console.error('❌ 找不到容器元素 #resultsContainer');
      return;
    }
    container.innerHTML = '';

    Object.keys(positionMap).forEach(position => {
      const section = document.createElement('div');
      section.className = 'position-section';
      
      let html = `<div class="position-title">${position}</div><div class="candidate-list">`;
      
      positionMap[position].forEach(c => {
        const color = parseFloat(c.rate) >= 50 ? '#16a34a' : '#dc2626';
        html += `
          <div class="candidate-card">
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-votes">${c.votes}票</div>
            <div class="candidate-rate" style="color:${color}">${c.rate}%</div>
          </div>`;
      });
      
      html += '</div>';
      section.innerHTML = html;
      container.appendChild(section);
    });

    // 8. 更新总参与人数
    const votedUsersEl = document.getElementById('votedUsers'); // 修复：去掉 'voted UsersEl' 空格
    if (votedUsersEl) votedUsersEl.innerText = totalVoteUsers;

    console.log('✅ 数据加载成功');
  } catch (err) {
    console.error('💥 后台加载异常:', err);
    alert('后台加载失败：' + err.message);
  }
}

// 🔗 关键修复：将异步函数挂载到 window，否则 HTML 的 onclick 无法调用
window.loadResults = loadResults;
window.refreshResults = loadResults;

// =======================
// 复位全部投票
// =======================
window.resetVotes = async function () {
  if (!confirm('确定清空全部投票数据？\n此操作不可恢复，是否继续？')) return;
  try {
    const { error: delErr } = await sb.from('votes').delete().neq('id', 0);
    if (delErr) throw delErr;
    
    const { error: updErr } = await sb.from('codes').update({ used: false }).neq('id', 0);
    if (updErr) throw updErr;
    
    alert('✅ 复位成功');
    loadResults();
  } catch (err) {
    alert('复位失败：' + err.message);
  }
};

// =======================
// Excel 导出
// =======================
const exportExcelBtn = document.getElementById('exportExcelBtn');

exportExcelBtn.addEventListener('click', async ()=>{
  const {data:candidates} = await db.from('candidates').select('*');
  const {data:voterData} = await db.from('votes').select('candidate_id,user_code');

  const uniqueUsers=[...new Set(voterData.map(v=>v.user_code))];
  const totalVoters = uniqueUsers.length;

  const groups = {};
  for(const c of candidates){
    if(!groups[c.position]) groups[c.position] = [];
    groups[c.position].push(c);
  }

  const sheetData = [];
  for(const pos in groups){
    for(const c of groups[pos]){
      const voteCount = voterData.filter(v=>v.candidate_id === c.id).length;
      const rate = totalVoters>0 ? Math.round(voteCount/totalVoters*100) : 0;
      sheetData.push({
        '岗位': pos,
        '候选人': c.name,
        '票数': voteCount,
        '得票率(%)': rate
      });
    }
  }

  // 生成 Excel
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '投票统计');
  XLSX.writeFile(wb, '投票统计.xlsx');
});