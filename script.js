// =========================
// 自动读取二维码 + 页面初始化
// =========================
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  console.log("二维码 code =", code);

  if (code) {
    const input = document.getElementById('userCode');
    if (input) {
      input.value = code.toUpperCase();
    }
    const userCodeDiv = document.querySelector('.user-code');
    if (userCodeDiv) {
      userCodeDiv.style.display = 'none';
    }
  }
  loadCandidates();
});

// =========================
// Supabase 初始化
// =========================
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const db = supabase.createClient(supabaseUrl, supabaseKey);

// =========================
// 获取页面元素
// =========================
const voteForm = document.getElementById('voteForm');
const submitBtn = document.getElementById('submitBtn');
let submitting = false;

// =========================
// 加载候选人 (保留原逻辑：根据 max_select 动态生成控件)
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

  // 生成岗位 DOM
  for (const [position, list] of Object.entries(groups)) {
    const div = document.createElement('div');
    div.className = 'position';
    
    const maxSelect = list[0].max_select || 1;
    // 将限制值存入 dataset，提交时直接读取，避免正则解析出错
    div.dataset.maxSelect = maxSelect;

    const title = document.createElement('h2');
    title.textContent = `${position}（限选${maxSelect}人，可少选）`;
    div.appendChild(title);

    list.forEach(c => {
      const label = document.createElement('label');
      const input = document.createElement('input');

      // 【核心保留】根据 max_select 决定类型
      input.type = maxSelect === 1 ? 'radio' : 'checkbox';
      // 使用统一前缀避免岗位名含空格导致 name 属性失效
      input.name = `pos_${position.replace(/\s+/g, '_')}`;
      input.value = c.id;

      // 多选限制：防止用户勾选超过 max_select
      if (maxSelect > 1) {
        input.addEventListener('change', () => {
          const checked = div.querySelectorAll('input:checked');
          if (checked.length > maxSelect) {
            input.checked = false;
            alert(`${position} 最多只能选择 ${maxSelect} 人`);
          }
        });
      }

      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + c.name));
      div.appendChild(label);
    });

    voteForm.appendChild(div);
  }
}

// =========================
// 提交投票 (新增少选确认逻辑)
// =========================
async function submitVote() {
  if (submitting) return;
  submitting = true;

  try {
    const userCode = document.getElementById('userCode').value.trim().toUpperCase();

    // 1. 校验序列码格式
    if (!userCode || userCode.length !== 5) {
      alert("请输入正确的5位序列码");
      submitting = false; return;
    }

    // 2. 验证序列码有效性
    const { data: codeData, error: codeError } = await db
      .from('codes')
      .select('*')
      .eq('code', userCode)
      .single();

    if (codeError || !codeData) {
      alert("序列码无效");
      submitting = false; return;
    }
    if (codeData.used) {
      alert("该序列码已使用，请勿重复投票");
      submitting = false; return;
    }

    // 3. 遍历岗位收集数据与未选项
    const positions = document.querySelectorAll('.position');
    const unselectedPositions = [];
    const voteArray = [];

    for (const div of positions) {
      const maxSelect = parseInt(div.dataset.maxSelect || 1);
      const titleEl = div.querySelector('h2');
      const positionName = titleEl.textContent.split('（')[0].trim();
      const checkedInputs = div.querySelectorAll('input:checked');

      // 安全拦截：防止恶意篡改前端导致超选
      if (checkedInputs.length > maxSelect) {
        alert(`${positionName} 最多只能选择 ${maxSelect} 人，请取消多余选项`);
        submitting = false; return;
      }

      if (checkedInputs.length === 0) {
        unselectedPositions.push(positionName);
      } else {
        checkedInputs.forEach(input => {
          voteArray.push({
            user_code: userCode,
            candidate_id: parseInt(input.value)
          });
        });
      }
    }

    // 4. 【核心交互】处理少选/弃权提示
    if (unselectedPositions.length > 0) {
      const msg = `⚠️ 提示：您尚未选择以下岗位的候选人：\n\n${unselectedPositions.join('、')}\n\n✅ 点击【确定】直接提交（未选项视为弃权）\n🔙 点击【取消】留在页面进行补选`;
      
      if (!confirm(msg)) {
        submitting = false;
        return; // 用户选择取消，中断提交，留在当前页面
      }
    }

    // 5. 写入投票数据 (若全部弃权则跳过 insert，避免空数组报错)
    if (voteArray.length > 0) {
      const { error: voteError } = await db.from('votes').insert(voteArray);
      if (voteError) {
        alert("投票记录写入失败：" + voteError.message);
        submitting = false; return;
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
      submitting = false; return;
    }

    // 7. 显示成功覆盖层
    const overlay = document.getElementById('successOverlay');
    if (overlay) overlay.style.display = 'flex';

    window.closePage = function () {
      if (overlay) overlay.style.display = 'none';
      window.open('', '_self');
      window.close();
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
// 复位功能
// =========================

const resetBtn = document.getElementById('resetVotesBtn');

resetBtn.addEventListener('click', async () => {

    // 第一次确认
    const confirm1 = confirm(
        '确定要清空所有投票数据吗？'
    );

    if (!confirm1) return;

    // 第二次确认
    const confirm2 = confirm(
        '此操作不可恢复！\n\n将执行：\n1. 清空全部投票\n2. 重置全部序列号\n\n是否继续？'
    );

    if (!confirm2) return;

    try {

        // 显示加载状态
        resetBtn.disabled = true;
        resetBtn.innerText = '正在复位...';

        // ========================
        // 1. 删除 votes 表
        // ========================

        const { error: deleteError } = await supabase
            .from('votes')
            .delete()
            .neq('id', 0);

        if (deleteError) throw deleteError;

        // ========================
        // 2. 重置 codes
        // ========================

        const { error: updateError } = await supabase
            .from('codes')
            .update({
                used: false
            })
            .neq('id', 0);

        if (updateError) throw updateError;

        // ========================
        // 3. 清空前端显示
        // ========================

        const cards = document.querySelectorAll('.candidate-card');

        cards.forEach(card => {

            const voteEl = card.querySelector('.vote-count');
            const rateEl = card.querySelector('.vote-rate');

            if (voteEl) voteEl.innerText = '0票';
            if (rateEl) rateEl.innerText = '0%';

        });

        // 总参与人数
        const totalEl = document.getElementById('totalVotes');

        if (totalEl) {
            totalEl.innerText = '0';
        }

        // ========================
        // 4. 提示成功
        // ========================

        alert('全部投票数据已复位成功！');

        // ========================
        // 5. 自动刷新后台数据
        // ========================

        if (typeof loadResults === 'function') {
            loadResults();
        }

    } catch (err) {

        console.error(err);

        alert('复位失败：' + err.message);

    } finally {

        resetBtn.disabled = false;
        resetBtn.innerText = '复位全部投票';

    }

});


// =========================
// 事件绑定
// =========================
submitBtn.addEventListener('click', submitVote);