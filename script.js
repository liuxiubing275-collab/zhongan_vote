// =========================
// 全局配置与初始化
// =========================
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const db = supabase.createClient(supabaseUrl, supabaseKey);

const voteForm = document.getElementById('voteForm');
const submitBtn = document.getElementById('submitBtn');
let submitting = false;

// =========================
// 页面加载与参数解析
// =========================
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  
  if (code) {
    const input = document.getElementById('userCode');
    if (input) input.value = code.toUpperCase();
    
    const userCodeDiv = document.querySelector('.user-code');
    if (userCodeDiv) userCodeDiv.style.display = 'none';
  }
  
  loadCandidates();
});

// =========================
// 动态加载候选人 (全部强制为单选/可弃权)
// =========================
async function loadCandidates() {
  const { data: candidates, error } = await db
    .from('candidates')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    alert("加载候选人失败：" + error.message);
    return;
  }

  // 按岗位分组
  const groups = {};
  candidates.forEach(c => {
    if (!groups[c.position]) groups[c.position] = [];
    groups[c.position].push(c);
  });

  // 渲染DOM
  for (const [position, list] of Object.entries(groups)) {
    const div = document.createElement('div');
    div.className = 'position';

    const title = document.createElement('h2');
    // 提示文案统一改为“单选或弃权”
    title.textContent = `${position}（单选或弃权）`;
    div.appendChild(title);

    list.forEach(c => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; // 强制单选
      input.name = `group_${position}`; // 按岗位隔离单选组
      input.value = c.id;
      
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + c.name));
      div.appendChild(label);
    });

    voteForm.appendChild(div);
  }
}

// =========================
// 提交投票核心逻辑
// =========================
async function submitVote() {
  if (submitting) return;
  submitting = true;

  try {
    // 1. 获取并校验序列码
    const userCode = document.getElementById('userCode').value.trim().toUpperCase();
    if (!userCode || userCode.length !== 5) {
      alert("请输入正确的5位序列码");
      submitting = false;
      return;
    }

    // 2. 验证序列码有效性
    const { data: codeData, error: codeError } = await db
      .from('codes')
      .select('*')
      .eq('code', userCode)
      .single();

    if (codeError || !codeData) {
      alert("序列码无效");
      submitting = false;
      return;
    }
    if (codeData.used) {
      alert("该序列码已使用，请勿重复投票");
      submitting = false;
      return;
    }

    // 3. 遍历岗位，校验选择情况并收集数据
    const positions = document.querySelectorAll('.position');
    const unselectedPositions = [];
    const voteArray = [];

    for (const div of positions) {
      const titleEl = div.querySelector('h2');
      const positionName = titleEl.textContent.split('（')[0].trim(); // 提取纯岗位名
      const checkedInputs = div.querySelectorAll('input:checked');

      // 防御性检查：防止HTML被篡改导致多选
      if (checkedInputs.length > 1) {
        alert(`${positionName} 仅支持单选，请取消多余选项后重试`);
        submitting = false;
        return;
      }

      if (checkedInputs.length === 0) {
        unselectedPositions.push(positionName);
      } else {
        voteArray.push({
          user_code: userCode,
          candidate_id: parseInt(checkedInputs[0].value)
        });
      }
    }

    // 4. 处理未选项提示逻辑
    if (unselectedPositions.length > 0) {
      const confirmMsg = `⚠️ 提示：您尚未选择以下岗位的候选人：\n\n${unselectedPositions.join('、')}\n\n✅ 点击【确定】将直接提交（未选项视为弃权）\n🔙 点击【取消】将留在页面进行补选`;
      
      if (!confirm(confirmMsg)) {
        submitting = false;
        return; // 用户选择取消，留在当前页面补选
      }
    }

    // 5. 写入投票数据 (若全部弃权则跳过插入，避免空数组报错)
    if (voteArray.length > 0) {
      const { error: voteError } = await db.from('votes').insert(voteArray);
      if (voteError) {
        alert("投票记录写入失败：" + voteError.message);
        submitting = false;
        return;
      }
    }

    // 6. 原子性锁定序列号
    const { error: updateError } = await db
      .from('codes')
      .update({ used: true })
      .eq('code', userCode)
      .eq('used', false);

    if (updateError) {
      alert("更新投票状态失败：" + updateError.message);
      submitting = false;
      return;
    }

    // 7. 显示成功覆盖层
    const overlay = document.getElementById('successOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 绑定关闭/跳转逻辑
    window.closePage = function () {
      if (overlay) overlay.style.display = 'none';
      window.open('', '_self');
      window.close();
      // 兼容部分移动端浏览器不允许 window.close() 的降级方案
      setTimeout(() => { location.href = 'about:blank'; }, 500);
    };

  } catch (err) {
    console.error("投票系统异常:", err);
    alert("系统发生未知错误，请刷新页面重试");
  } finally {
    submitting = false;
  }
}

// =========================
// 事件绑定
// =========================
submitBtn.addEventListener('click', submitVote);