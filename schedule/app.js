/* ====================================================
   脑波时钟 (BrainRhythm Scheduler) - 核心逻辑
   人脑生物节律与认知能量曲线智能排程引擎
   ==================================================== */

// 标准人脑认知黄金时段定义
const COGNITIVE_PHASES = [
  { start: "07:00", end: "08:30", key: "wake", name: "🌅 晨间唤醒启动", tip: "皮质醇逐渐上升，适合晨光补水与低负荷计划梳理" },
  { start: "08:30", end: "11:30", key: "deep_work", name: "👑 黄金攻坚最高峰", tip: "前额叶皮层最活跃，专注力达全天顶峰！适合吞掉最难的青蛙" },
  { start: "11:30", end: "13:00", key: "trans", name: "🍲 能量充能过渡", tip: "大脑血糖稍降，适宜午餐与轻松交流，避免高负荷决策" },
  { start: "13:00", end: "14:00", key: "dip", name: "💤 生理低谷小憩", tip: "体温微降副交感占优，推荐 20 分钟小憩 (Power Nap) 或整理杂务" },
  { start: "14:00", end: "16:30", key: "agile_exec", name: "🚀 敏捷执行与协同", tip: "认知二次高峰，情绪稳定，适合多任务推进、会议与技能训练" },
  { start: "16:30", end: "18:30", key: "creative_fitness", name: "🎨 运动发散与灵感", tip: "体温峰值，运动表现最佳；注意力稍松，利于创意与脑暴" },
  { start: "18:30", end: "20:00", key: "evening_rest", name: "🌿 生活晚休休整", tip: "营养晚餐与陪伴，从日间工作模式平缓过渡" },
  { start: "20:00", end: "21:30", key: "review_winddown", name: "📖 记忆整合与复盘", tip: "海马体准备在夜间固化记忆，适合温和复习与日总结" },
  { start: "21:30", end: "23:00", key: "sleep_prep", name: "🌙 睡前清空与入眠", tip: "褪黑素分泌，倾倒明日任务以清空焦躁，准备入睡" }
];

const CATEGORY_MAP = {
  deep_work: { name: '深度攻坚', emoji: '🧠', class: 'deep_work', defaultSlot: '08:30' },
  agile_exec: { name: '敏捷执行', emoji: '🚀', class: 'agile_exec', defaultSlot: '14:00' },
  creative_fitness: { name: '运动发散', emoji: '🎨', class: 'creative_fitness', defaultSlot: '16:30' },
  low_routine: { name: '琐碎低谷', emoji: '☕', class: 'low_routine', defaultSlot: '13:00' },
  review_winddown: { name: '复盘整合', emoji: '📖', class: 'review_winddown', defaultSlot: '20:00' },
  life_recharge: { name: '生活充能', emoji: '🌱', class: 'life_recharge', defaultSlot: '11:30' }
};

class BrainRhythmScheduler {
  constructor() {
    this.tasks = this.loadTasks();
    this.currentFilter = 'all';
    this.isMiniMode = localStorage.getItem('brain_scheduler_mini') === 'true';
    this.currentTheme = localStorage.getItem('brain_scheduler_theme') || 'dark';

    // 计时器与音频状态
    this.activeTimerSeconds = 0;
    this.isTimerRunning = false;
    this.timerInterval = null;
    this.alphaAudioActive = false;
    this.audioCtx = null;
    this.binauralOsc1 = null;
    this.binauralOsc2 = null;

    // 语音识别
    this.speechRecognition = null;
    this.isRecording = false;

    this.initDOM();
    this.initTheme();
    this.initClock();
    this.initServiceWorker();
    this.initVoiceRecognition();
    this.renderAll();

    // 启动每秒时钟和节律检测
    setInterval(() => this.tick(), 1000);
  }

  // ----------------------------------------------------
  // LocalStorage 数据持久化
  // ----------------------------------------------------
  loadTasks() {
    try {
      const data = localStorage.getItem('brain_scheduler_tasks_v1');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('加载任务失败:', e);
    }
    return this.getDefaultTasks();
  }

  saveTasks() {
    try {
      localStorage.setItem('brain_scheduler_tasks_v1', JSON.stringify(this.tasks));
    } catch (e) {
      console.error('保存任务失败:', e);
    }
  }

  getDefaultTasks() {
    return [
      {
        id: 'task-1',
        title: '晨间唤醒与全天要事速览',
        startTime: '07:30',
        endTime: '08:15',
        category: 'life_recharge',
        notes: '喝温水、晨光拉伸、开启今日认知节律',
        completed: true
      },
      {
        id: 'task-2',
        title: '吞掉大青蛙：核心学习/工作深度攻坚',
        startTime: '08:30',
        endTime: '11:00',
        category: 'deep_work',
        notes: '前额叶认知黄金期！无打扰、关闭消息通知，专注最艰难任务',
        completed: false
      },
      {
        id: 'task-3',
        title: '营养午餐与 20 分钟闭目小憩 (Power Nap)',
        startTime: '12:00',
        endTime: '13:30',
        category: 'low_routine',
        notes: '顺应午后生理低谷，恢复脑力与体力',
        completed: false
      },
      {
        id: 'task-4',
        title: '关键事项推进、沟通与会议协同',
        startTime: '14:00',
        endTime: '16:00',
        category: 'agile_exec',
        notes: '认知二次高峰，推进需要多方协作与执行的事务',
        completed: false
      },
      {
        id: 'task-5',
        title: '有氧跑步/力量健身与创意发散',
        startTime: '16:45',
        endTime: '18:00',
        category: 'creative_fitness',
        notes: '体温全天最高点，运动发汗，释放多巴胺',
        completed: false
      },
      {
        id: 'task-6',
        title: '今日所学温和复盘与知识巩固',
        startTime: '20:00',
        endTime: '21:00',
        category: 'review_winddown',
        notes: '艾宾浩斯当晚强化，将短期记忆打入夜间睡眠固化',
        completed: false
      },
      {
        id: 'task-7',
        title: '🌙 晚间大脑倾倒 (Brain Dump) & 明日排程',
        startTime: '21:30',
        endTime: '22:00',
        category: 'review_winddown',
        notes: '写下明日计划清空工作记忆，安心睡眠',
        completed: false
      }
    ];
  }

  // ----------------------------------------------------
  // DOM 元素与事件绑定
  // ----------------------------------------------------
  initDOM() {
    this.appLayout = document.getElementById('appLayout');
    this.headerLiveTime = document.getElementById('headerLiveTime');
    this.headerLiveDate = document.getElementById('headerLiveDate');
    this.energyPhaseText = document.getElementById('energyPhaseText');
    this.energyTipText = document.getElementById('energyTipText');
    this.rhythmNowCursor = document.getElementById('rhythmNowCursor');

    // Hero Focus Card
    this.heroTaskTag = document.getElementById('heroTaskTag');
    this.heroTaskTimeSlot = document.getElementById('heroTaskTimeSlot');
    this.heroTaskTitle = document.getElementById('heroTaskTitle');
    this.heroTaskNotes = document.getElementById('heroTaskNotes');
    this.heroTimerDisplay = document.getElementById('heroTimerDisplay');
    this.heroTimerToggleBtn = document.getElementById('heroTimerToggleBtn');
    this.heroTimerToggleIcon = document.getElementById('heroTimerToggleIcon');
    this.heroTimerToggleText = document.getElementById('heroTimerToggleText');
    this.heroTimerResetBtn = document.getElementById('heroTimerResetBtn');
    this.heroAlphaAudioBtn = document.getElementById('heroAlphaAudioBtn');
    this.heroCompleteBtn = document.getElementById('heroCompleteBtn');

    // Schedule Timeline
    this.tasksTimelineList = document.getElementById('tasksTimelineList');
    this.emptyScheduleState = document.getElementById('emptyScheduleState');
    this.streamCounterBadge = document.getElementById('streamCounterBadge');

    // Mini Widget Panel
    this.miniWidgetPanel = document.getElementById('miniWidgetPanel');
    this.miniLiveClock = document.getElementById('miniLiveClock');
    this.miniPhaseBadge = document.getElementById('miniPhaseBadge');
    this.miniTaskTitle = document.getElementById('miniTaskTitle');
    this.miniTaskSlot = document.getElementById('miniTaskSlot');
    this.miniTaskTimer = document.getElementById('miniTaskTimer');
    this.miniDoneBtn = document.getElementById('miniDoneBtn');
    this.miniUpcomingTitle = document.getElementById('miniUpcomingTitle');
    this.miniExpandBtn = document.getElementById('miniExpandBtn');

    // 模态弹窗与按键
    this.eveningModal = document.getElementById('eveningModal');
    this.openEveningPlanBtn = document.getElementById('openEveningPlanBtn');
    this.closeEveningModalBtn = document.getElementById('closeEveningModalBtn');
    this.eveningTasksInput = document.getElementById('eveningTasksInput');
    this.eveningVoiceBtn = document.getElementById('eveningVoiceBtn');
    this.eveningVoiceIcon = document.getElementById('eveningVoiceIcon');
    this.eveningVoiceText = document.getElementById('eveningVoiceText');
    this.planWakeTime = document.getElementById('planWakeTime');
    this.planSleepTime = document.getElementById('planSleepTime');
    this.previewPlanBtn = document.getElementById('previewPlanBtn');
    this.confirmApplyPlanBtn = document.getElementById('confirmApplyPlanBtn');
    this.schedulePreviewBox = document.getElementById('schedulePreviewBox');
    this.previewSlotsList = document.getElementById('previewSlotsList');
    this.previewSummaryBadge = document.getElementById('previewSummaryBadge');

    // 智能排程模式选项 (从现在即刻 vs 明日全天)
    this.modeFromNow = document.getElementById('modeFromNow');
    this.modeTomorrow = document.getElementById('modeTomorrow');
    this.modeNowLabel = document.getElementById('modeNowLabel');
    this.modeTomorrowLabel = document.getElementById('modeTomorrowLabel');
    this.nowTimeDisplay = document.getElementById('nowTimeDisplay');
    this.tomorrowAdjustBox = document.getElementById('tomorrowAdjustBox');

    // 导入 AI 规划弹窗
    this.importModal = document.getElementById('importModal');
    this.openImportModalBtn = document.getElementById('openImportModalBtn');
    this.closeImportModalBtn = document.getElementById('closeImportModalBtn');
    this.cancelImportBtn = document.getElementById('cancelImportBtn');
    this.doImportBtn = document.getElementById('doImportBtn');
    this.importJsonInput = document.getElementById('importJsonInput');

    // 任务单项编辑弹窗
    this.taskEditModal = document.getElementById('taskEditModal');
    this.taskEditForm = document.getElementById('taskEditForm');
    this.closeTaskEditModalBtn = document.getElementById('closeTaskEditModalBtn');
    this.cancelTaskEditBtn = document.getElementById('cancelTaskEditBtn');
    this.addNewTaskBtn = document.getElementById('addNewTaskBtn');
    this.editTaskId = document.getElementById('editTaskId');
    this.editTaskTitle = document.getElementById('editTaskTitle');
    this.editTaskStart = document.getElementById('editTaskStart');
    this.editTaskEnd = document.getElementById('editTaskEnd');
    this.editTaskCategory = document.getElementById('editTaskCategory');
    this.editTaskNotes = document.getElementById('editTaskNotes');
    this.editModalTitle = document.getElementById('editModalTitle');

    // 主题与小挂件切换
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIconSun = document.getElementById('themeIconSun');
    this.themeIconMoon = document.getElementById('themeIconMoon');
    this.toggleMiniWidgetBtn = document.getElementById('toggleMiniWidgetBtn');

    this.bindEvents();
  }

  bindEvents() {
    // 智能排程弹窗
    this.openEveningPlanBtn.addEventListener('click', () => this.openEveningModal());
    this.closeEveningModalBtn.addEventListener('click', () => this.closeEveningModal());
    this.previewPlanBtn.addEventListener('click', () => this.generateHeuristicSchedule());
    this.confirmApplyPlanBtn.addEventListener('click', () => this.applyGeneratedSchedule());

    // 模式切换监听 (从现在即刻 vs 明日全天)
    if (this.modeFromNow && this.modeTomorrow) {
      this.modeFromNow.addEventListener('change', () => {
        this.modeNowLabel.classList.add('active');
        this.modeTomorrowLabel.classList.remove('active');
        if (this.tomorrowAdjustBox) this.tomorrowAdjustBox.style.display = 'none';
      });
      this.modeTomorrow.addEventListener('change', () => {
        this.modeTomorrowLabel.classList.add('active');
        this.modeNowLabel.classList.remove('active');
        if (this.tomorrowAdjustBox) this.tomorrowAdjustBox.style.display = 'flex';
      });
    }

    // 模版快速点击添加
    document.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text;
        const current = this.eveningTasksInput.value.trim();
        this.eveningTasksInput.value = current ? current + '\n' + text : text;
        this.eveningTasksInput.focus();
      });
    });

    // 语音录音
    this.eveningVoiceBtn.addEventListener('click', () => this.toggleVoiceRecording());

    // 导入 AI 日程
    this.openImportModalBtn.addEventListener('click', () => {
      this.importJsonInput.value = '';
      this.importModal.classList.add('active');
    });
    this.closeImportModalBtn.addEventListener('click', () => this.importModal.classList.remove('active'));
    this.cancelImportBtn.addEventListener('click', () => this.importModal.classList.remove('active'));
    this.doImportBtn.addEventListener('click', () => this.handleDoImport());

    // 添加任务
    this.addNewTaskBtn.addEventListener('click', () => this.openTaskEditModal(null));
    this.closeTaskEditModalBtn.addEventListener('click', () => this.taskEditModal.classList.remove('active'));
    this.cancelTaskEditBtn.addEventListener('click', () => this.taskEditModal.classList.remove('active'));
    this.taskEditForm.addEventListener('submit', (e) => this.handleSaveTaskForm(e));

    // 过滤药丸
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter;
        this.renderTimeline();
      });
    });

    // Hero 计时器控制
    this.heroTimerToggleBtn.addEventListener('click', () => this.toggleTimer());
    this.heroTimerResetBtn.addEventListener('click', () => this.resetTimer());
    this.heroAlphaAudioBtn.addEventListener('click', () => this.toggleAlphaAudio());
    this.heroCompleteBtn.addEventListener('click', () => this.completeCurrentHeroTask());
    this.miniDoneBtn.addEventListener('click', () => this.completeCurrentHeroTask());

    // 桌面小组件模式切换
    this.toggleMiniWidgetBtn.addEventListener('click', () => this.toggleMiniMode());
    this.miniExpandBtn.addEventListener('click', () => this.toggleMiniMode(false));

    // 主题切换
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
  }

  // ----------------------------------------------------
  // 主题与外观管理 (Theme & Modes)
  // ----------------------------------------------------
  initTheme() {
    this.applyTheme(this.currentTheme);
    if (this.isMiniMode) {
      this.appLayout.classList.add('mini-mode');
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('brain_scheduler_theme', this.currentTheme);
    this.applyTheme(this.currentTheme);
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      this.themeIconSun.style.display = 'block';
      this.themeIconMoon.style.display = 'none';
    } else {
      document.body.classList.remove('dark-mode');
      this.themeIconSun.style.display = 'none';
      this.themeIconMoon.style.display = 'block';
    }
  }

  toggleMiniMode(forcedState) {
    if (typeof forcedState === 'boolean') {
      this.isMiniMode = forcedState;
    } else {
      this.isMiniMode = !this.isMiniMode;
    }
    localStorage.setItem('brain_scheduler_mini', this.isMiniMode ? 'true' : 'false');
    if (this.isMiniMode) {
      this.appLayout.classList.add('mini-mode');
      this.showToast('🖥️ 已切换为桌面极简小挂件模式');
    } else {
      this.appLayout.classList.remove('mini-mode');
      this.showToast('⤢ 已恢复完整日程看板');
    }
  }

  // ----------------------------------------------------
  // 时钟更新与实时节律评估 (Live Tick)
  // ----------------------------------------------------
  initClock() {
    this.tick();
  }

  tick() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    const hmStr = `${hours}:${minutes}`;

    if (this.headerLiveTime) this.headerLiveTime.innerText = timeStr;
    if (this.miniLiveClock) this.miniLiveClock.innerText = `${hours}:${minutes}`;

    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const month = now.getMonth() + 1;
    const date = now.getDate();
    if (this.headerLiveDate) {
      this.headerLiveDate.innerText = `${month}月${date}日 ${days[now.getDay()]}`;
    }

    // 更新能量光带 NOW 指针
    this.updateRhythmCursor(now);

    // 评估当前认知节律阶段
    this.updateCurrentCognitivePhase(hmStr);

    // 更新当前正在聚焦的 Hero 任务
    this.updateActiveFocusTask(hmStr);
  }

  updateRhythmCursor(now) {
    // 07:00 (420 min) 到 23:00 (1380 min) 全天 960 分钟映射
    const startMins = 7 * 60;
    const endMins = 23 * 60;
    const currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    let pct = ((currentMins - startMins) / (endMins - startMins)) * 100;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    if (this.rhythmNowCursor) {
      this.rhythmNowCursor.style.left = `${pct.toFixed(2)}%`;
    }
  }

  updateCurrentCognitivePhase(hmStr) {
    let currentPhase = null;
    for (const phase of COGNITIVE_PHASES) {
      if (hmStr >= phase.start && hmStr < phase.end) {
        currentPhase = phase;
        break;
      }
    }
    if (!currentPhase) {
      currentPhase = { name: "🌙 深度睡眠恢复期", tip: "慢波睡眠正在进行突触修剪与长时记忆重放" };
    }

    if (this.energyPhaseText) this.energyPhaseText.innerText = currentPhase.name;
    if (this.energyTipText) this.energyTipText.innerText = `· ${currentPhase.tip}`;
    if (this.miniPhaseBadge) this.miniPhaseBadge.innerText = currentPhase.name.replace(/^[^\s]+\s/, '');
  }

  // ----------------------------------------------------
  // Hero 焦点任务与倒计时 (Focus Task Engine)
  // ----------------------------------------------------
  updateActiveFocusTask(hmStr) {
    const sorted = [...this.tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    // 1. 查找当前时间区间内的未完成任务
    let activeTask = sorted.find(t => !t.completed && hmStr >= t.startTime && hmStr < t.endTime);

    // 2. 如果当前没有正在进行的，寻找下一个最近即将开始的未完成任务
    let nextUpcomingTask = null;
    if (!activeTask) {
      activeTask = sorted.find(t => !t.completed && hmStr < t.startTime);
      if (!activeTask) {
        // 如果全天都过了或已完成，取第一个未完成或最后一个
        activeTask = sorted.find(t => !t.completed) || sorted[sorted.length - 1];
      }
    } else {
      const activeIdx = sorted.indexOf(activeTask);
      nextUpcomingTask = sorted.slice(activeIdx + 1).find(t => !t.completed);
    }

    this.currentHeroTask = activeTask;

    if (!activeTask) {
      this.heroTaskTitle.innerText = '全天任务均已圆满完成 🎉';
      this.heroTaskNotes.innerText = '所有认知节律规划任务已打勾，安心放松，享受晚间时光！';
      this.heroTaskTimeSlot.innerText = '--:--';
      this.heroTaskTag.innerText = '✨ 完美收官';
      this.heroTimerDisplay.innerText = '00:00';
      if (this.miniTaskTitle) this.miniTaskTitle.innerText = '已全部完成 🎉';
      if (this.miniTaskSlot) this.miniTaskSlot.innerText = '--:--';
      if (this.miniTaskTimer) this.miniTaskTimer.innerText = '00:00';
      return;
    }

    const catInfo = CATEGORY_MAP[activeTask.category] || CATEGORY_MAP.deep_work;
    this.heroTaskTag.innerText = `${catInfo.emoji} ${catInfo.name}`;
    this.heroTaskTimeSlot.innerText = `${activeTask.startTime} ~ ${activeTask.endTime}`;
    this.heroTaskTitle.innerText = activeTask.title;
    this.heroTaskNotes.innerText = activeTask.notes || '按照人脑节律全心投入，避免多任务分散专注。';

    // 更新迷你面板
    if (this.miniTaskTitle) this.miniTaskTitle.innerText = activeTask.title;
    if (this.miniTaskSlot) this.miniTaskSlot.innerText = `${activeTask.startTime} ~ ${activeTask.endTime}`;
    if (this.miniUpcomingTitle) {
      this.miniUpcomingTitle.innerText = nextUpcomingTask ? `${nextUpcomingTask.startTime} ${nextUpcomingTask.title}` : '今日无后续任务';
    }

    // 计算倒计时秒数
    if (!this.isTimerRunning) {
      const now = new Date();
      const [endH, endM] = activeTask.endTime.split(':').map(Number);
      const target = new Date();
      target.setHours(endH, endM, 0, 0);

      const diffSecs = Math.max(0, Math.floor((target - now) / 1000));
      this.activeTimerSeconds = diffSecs;
      this.updateTimerDisplay();
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.activeTimerSeconds / 60);
    const secs = this.activeTimerSeconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (this.heroTimerDisplay) this.heroTimerDisplay.innerText = str;
    if (this.miniTaskTimer) this.miniTaskTimer.innerText = str;
  }

  toggleTimer() {
    this.isTimerRunning = !this.isTimerRunning;
    if (this.isTimerRunning) {
      this.heroTimerToggleIcon.innerText = '⏸';
      this.heroTimerToggleText.innerText = '暂停';
      this.timerInterval = setInterval(() => {
        if (this.activeTimerSeconds > 0) {
          this.activeTimerSeconds--;
          this.updateTimerDisplay();
        } else {
          this.playBellChime();
          this.showToast('⏰ 当前任务时间到！请稍微放松喝口水');
          this.toggleTimer();
        }
      }, 1000);
    } else {
      this.heroTimerToggleIcon.innerText = '▶';
      this.heroTimerToggleText.innerText = '继续';
      clearInterval(this.timerInterval);
    }
  }

  resetTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.isTimerRunning = false;
    this.heroTimerToggleIcon.innerText = '▶';
    this.heroTimerToggleText.innerText = '开始计时';
    const hmStr = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    this.updateActiveFocusTask(hmStr);
  }

  completeCurrentHeroTask() {
    if (!this.currentHeroTask) return;
    this.toggleTaskStatus(this.currentHeroTask.id);
    this.playBellChime();
    this.showToast(`🎉 已完成「${this.currentHeroTask.title}」！`);
  }

  // ----------------------------------------------------
  // 音频引擎 (Web Audio API - 纯纯免外链)
  // ----------------------------------------------------
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playBellChime() {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  toggleAlphaAudio() {
    this.alphaAudioActive = !this.alphaAudioActive;
    if (this.alphaAudioActive) {
      this.startAlphaDrone();
      this.heroAlphaAudioBtn.innerText = '🎵 脑波音: 开';
      this.heroAlphaAudioBtn.style.color = 'var(--primary)';
      this.heroAlphaAudioBtn.style.borderColor = 'var(--primary)';
      this.showToast('🎧 432Hz Alpha 专注脑波已开启，助您进入深度心流');
    } else {
      this.stopAlphaDrone();
      this.heroAlphaAudioBtn.innerText = '🎵 脑波音: 关';
      this.heroAlphaAudioBtn.style.color = '';
      this.heroAlphaAudioBtn.style.borderColor = '';
    }
  }

  startAlphaDrone() {
    try {
      const ctx = this.getAudioContext();
      // 双耳节律：基频 216Hz + 226Hz => 差频 10Hz (标准 Alpha 专注波)
      this.binauralOsc1 = ctx.createOscillator();
      this.binauralOsc2 = ctx.createOscillator();
      this.binauralGain = ctx.createGain();

      this.binauralOsc1.type = 'sine';
      this.binauralOsc1.frequency.value = 216;

      this.binauralOsc2.type = 'sine';
      this.binauralOsc2.frequency.value = 226;

      this.binauralGain.gain.setValueAtTime(0.06, ctx.currentTime);

      this.binauralOsc1.connect(this.binauralGain);
      this.binauralOsc2.connect(this.binauralGain);
      this.binauralGain.connect(ctx.destination);

      this.binauralOsc1.start();
      this.binauralOsc2.start();
    } catch (e) {
      console.warn('Alpha drone error:', e);
    }
  }

  stopAlphaDrone() {
    try {
      if (this.binauralOsc1) {
        this.binauralOsc1.stop();
        this.binauralOsc1.disconnect();
      }
      if (this.binauralOsc2) {
        this.binauralOsc2.stop();
        this.binauralOsc2.disconnect();
      }
    } catch (e) {}
  }

  // ----------------------------------------------------
  // 日程流渲染 (Render Timeline Stream)
  // ----------------------------------------------------
  renderAll() {
    this.renderTimeline();
    const hmStr = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    this.updateActiveFocusTask(hmStr);
  }

  renderTimeline() {
    if (!this.tasksTimelineList) return;
    this.tasksTimelineList.innerHTML = '';

    const sorted = [...this.tasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const filtered = sorted.filter(t => {
      if (this.currentFilter === 'pending') return !t.completed;
      if (this.currentFilter === 'done') return t.completed;
      return true;
    });

    // 统计角标
    const doneCount = this.tasks.filter(t => t.completed).length;
    this.streamCounterBadge.innerText = `${doneCount} / ${this.tasks.length} 已完成`;

    if (filtered.length === 0) {
      this.emptyScheduleState.style.display = 'block';
      return;
    } else {
      this.emptyScheduleState.style.display = 'none';
    }

    const nowHm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    filtered.forEach(task => {
      const isCurrent = !task.completed && nowHm >= task.startTime && nowHm < task.endTime;
      const catInfo = CATEGORY_MAP[task.category] || CATEGORY_MAP.deep_work;

      const card = document.createElement('div');
      card.className = `task-item-card ${isCurrent ? 'is-current' : ''} ${task.completed ? 'is-done' : ''}`;

      card.innerHTML = `
        <div class="task-left-col">
          <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}" title="点击打勾">
            ${task.completed ? '✓' : ''}
          </div>
          <div class="task-time-box">
            <div class="task-time-range">${task.startTime} ~ ${task.endTime}</div>
            <div class="task-duration-badge">${this.calcDurationText(task.startTime, task.endTime)}</div>
          </div>
          <div class="task-details">
            <div class="task-meta-row">
              <span class="task-category-pill ${catInfo.class}">${catInfo.emoji} ${catInfo.name}</span>
              ${isCurrent ? '<span style="font-size:0.7rem; font-weight:800; color:var(--primary);">● 正在进行</span>' : ''}
            </div>
            <div class="task-title">${this.escapeHtml(task.title)}</div>
            ${task.notes ? `<div class="task-notes">${this.escapeHtml(task.notes)}</div>` : ''}
          </div>
        </div>

        <div class="task-actions">
          <button class="task-action-btn edit" data-id="${task.id}" title="编辑任务">✏️</button>
          <button class="task-action-btn delete" data-id="${task.id}" title="删除任务">🗑️</button>
        </div>
      `;

      // 绑定打勾
      card.querySelector('.task-checkbox').addEventListener('click', () => {
        this.toggleTaskStatus(task.id);
        if (!task.completed) {
          this.playBellChime();
        }
      });

      // 编辑
      card.querySelector('.task-action-btn.edit').addEventListener('click', () => {
        this.openTaskEditModal(task);
      });

      // 删除
      card.querySelector('.task-action-btn.delete').addEventListener('click', () => {
        if (confirm(`确定删除任务「${task.title}」吗？`)) {
          this.tasks = this.tasks.filter(t => t.id !== task.id);
          this.saveTasks();
          this.renderAll();
          this.showToast('已删除任务');
        }
      });

      this.tasksTimelineList.appendChild(card);
    });
  }

  toggleTaskStatus(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this.saveTasks();
      this.renderAll();
    }
  }

  calcDurationText(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    if (diff < 60) return `${diff}分钟`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}小时${m}分` : `${h}小时`;
  }

  // ----------------------------------------------------
  // ⚡ 认知节律智能排程 (支持白天即刻开始 / 晚间规划明日)
  // ----------------------------------------------------
  openEveningModal() {
    this.schedulePreviewBox.style.display = 'none';
    this.confirmApplyPlanBtn.style.display = 'none';
    this.previewPlanBtn.style.display = 'inline-flex';

    // 动态刷新当前时刻指示
    const now = new Date();
    const curH = String(now.getHours()).padStart(2, '0');
    const curM = String(now.getMinutes()).padStart(2, '0');
    if (this.nowTimeDisplay) {
      this.nowTimeDisplay.innerText = `${curH}:${curM}`;
    }

    this.eveningModal.classList.add('active');
  }

  closeEveningModal() {
    this.eveningModal.classList.remove('active');
    if (this.isRecording) {
      this.stopVoiceRecording();
    }
  }

  // 语音识别初始化
  initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'zh-CN';

      this.speechRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          const current = this.eveningTasksInput.value;
          this.eveningTasksInput.value = current ? current + '\n' + transcript : transcript;
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn('Speech error:', e);
        this.stopVoiceRecording();
      };

      this.speechRecognition.onend = () => {
        if (this.isRecording) {
          this.speechRecognition.start();
        }
      };
    }
  }

  toggleVoiceRecording() {
    if (!this.speechRecognition) {
      alert('您的浏览器暂未开放内置麦克风语音转文字权限，可直接打字或粘贴任务列表哦！');
      return;
    }
    if (this.isRecording) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  startVoiceRecording() {
    try {
      this.speechRecognition.start();
      this.isRecording = true;
      this.eveningVoiceBtn.classList.add('recording');
      this.eveningVoiceIcon.innerText = '⏹️';
      this.eveningVoiceText.innerText = '正在聆听...';
      this.showToast('🎙️ 请说出您明天的任务列表，说完点击停止');
    } catch (e) {
      console.warn('Start voice error:', e);
    }
  }

  stopVoiceRecording() {
    try {
      this.speechRecognition.stop();
    } catch (e) {}
    this.isRecording = false;
    this.eveningVoiceBtn.classList.remove('recording');
    this.eveningVoiceIcon.innerText = '🎙️';
    this.eveningVoiceText.innerText = '语音输入';
  }

  // ----------------------------------------------------
  // 自然语言多任务智能解析器 (支持单句顿号/逗号连缀与多行)
  // ----------------------------------------------------
  parseInputTasks(rawText) {
    let text = rawText
      .replace(/一个半小时/g, '1.5小时')
      .replace(/两个半小时/g, '2.5小时')
      .replace(/半小时/g, '30分钟')
      .replace(/一刻钟/g, '15分钟')
      .replace(/大半天/g, '3小时');

    const cnNums = {
      '一个': '1', '两个': '2', '三个': '3', '四个': '4', '五个': '5', '六个': '6', '七个': '7', '八个': '8',
      '一': '1', '两': '2', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10'
    };
    for (const [k, v] of Object.entries(cnNums)) {
      text = text.replace(new RegExp(`${k}\\s*(?:个)?\\s*(小时|h|hr|分钟|分|m|min)`, 'gi'), `${v}$1`);
    }

    // 智能多维度拆分：支持换行、顿号、分号、逗号、句号，以及还要/然后/接着等连词
    const delimiters = /[\n\r;；。]+|(?:[，,、]|还要|然后|接着|再|并且|其次|最后)\s*/g;
    const rawChunks = text.split(delimiters);

    const parsedTasks = [];

    const deepKeywords = ['高数', '代数', '数学', '论文', '论证', '核心', '攻坚', '深度', '算法', '代码', '编程', 'python', 'java', 'c++', '写作', '考研', '难题', '专心', '研究', '思考', '分析'];
    const meetingKeywords = ['会', '组会', '沟通', '讨论', '协作', '汇报', '面试', '电话', '同步', '对齐', '客户'];
    const sportsKeywords = ['跑', '健身', '运动', '有氧', '拉伸', '散步', '走', '发散', '脑暴', '创意', '灵感', '设计', '构思'];
    const routineKeywords = ['邮件', '表格', '下载', '整理', '打扫', '收拾', '报销', '买', '采购', '缴费', '快递', '琐碎'];
    const reviewKeywords = ['复盘', '复习', '总结', '艾宾浩斯', '回顾', '笔记'];

    rawChunks.forEach((chunk, idx) => {
      let c = chunk.trim();
      if (!c || c.length < 2) return;

      // 提取时长估算 (如 "3 个小时", "3h", "45分钟", "45分")
      let durationMins = 45;
      const hourMatch = c.match(/(\d+(?:\.\d+)?)\s*(?:个)?\s*(?:小时|h|hr)/i);
      const minMatch = c.match(/(\d+)\s*(?:分钟|分|m|min)/i);

      if (hourMatch) {
        durationMins = Math.round(parseFloat(hourMatch[1]) * 60);
      } else if (minMatch) {
        durationMins = parseInt(minMatch[1], 10);
      }

      // 提取指定固定时间点 (如 "下午3点", "15:00")
      let fixedStart = null;
      const timeMatch1 = c.match(/(上午|下午|晚上)?\s*(\d{1,2})[:：](\d{2})/);
      const timeMatch2 = c.match(/(下午|晚上)\s*(\d{1,2})\s*点/);
      const timeMatch3 = c.match(/(上午)\s*(\d{1,2})\s*点/);

      if (timeMatch1) {
        let h = parseInt(timeMatch1[2], 10);
        const m = parseInt(timeMatch1[3], 10);
        if ((timeMatch1[1] === '下午' || timeMatch1[1] === '晚上') && h < 12) h += 12;
        fixedStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      } else if (timeMatch2) {
        let h = parseInt(timeMatch2[2], 10);
        if (h < 12) h += 12;
        fixedStart = `${String(h).padStart(2, '0')}:00`;
      } else if (timeMatch3) {
        let h = parseInt(timeMatch3[2], 10);
        fixedStart = `${String(h).padStart(2, '0')}:00`;
      }

      // 清理纯标题
      let cleanTitle = c
        .replace(/^(我写了|我要|我打算|我准备|要|需要|打算|计划|准备|还要|想|去)\s*/, '')
        .replace(/\d+(?:\.\d+)?\s*(?:个)?\s*(?:小时|分钟|分|h|hr|m|min)/gi, '')
        .replace(/(上午|下午|晚上)?\s*\d{1,2}([:：]\d{2}|点)/g, '')
        .replace(/[，,、。！？\s]+$/, '')
        .trim();

      if (!cleanTitle) cleanTitle = c;

      // 判定认知分类
      let category = 'deep_work';
      const lower = cleanTitle.toLowerCase();
      if (meetingKeywords.some(k => lower.includes(k))) {
        category = 'agile_exec';
      } else if (sportsKeywords.some(k => lower.includes(k))) {
        category = 'creative_fitness';
      } else if (routineKeywords.some(k => lower.includes(k))) {
        category = 'low_routine';
      } else if (reviewKeywords.some(k => lower.includes(k))) {
        category = 'review_winddown';
      } else if (deepKeywords.some(k => lower.includes(k))) {
        category = 'deep_work';
      }

      parsedTasks.push({
        id: `gen-${Date.now()}-${idx}`,
        title: cleanTitle,
        category,
        durationMins,
        fixedStart,
        notes: `计划专注时长：${durationMins >= 60 ? (durationMins / 60) + '小时' : durationMins + '分钟'}`
      });
    });

    return parsedTasks;
  }

  // ----------------------------------------------------
  // 启发式认知节律排程算法 (生成排程预览)
  // ----------------------------------------------------
  generateHeuristicSchedule() {
    const rawText = this.eveningTasksInput.value.trim();
    if (!rawText) {
      alert('请先输入或说出要安排的任务哦！');
      return;
    }

    const parsedTasks = this.parseInputTasks(rawText);
    if (parsedTasks.length === 0) {
      alert('未能解析出具体任务，请写下具体任务名称和大概时长（如：学习高数 3小时）');
      return;
    }

    const isTomorrowMode = this.modeTomorrow && this.modeTomorrow.checked;
    this.currentSchedulingMode = isTomorrowMode ? 'tomorrow' : 'now';

    let scheduled = [];
    if (isTomorrowMode) {
      scheduled = this.slotTasksTomorrow(parsedTasks);
    } else {
      scheduled = this.slotTasksFromNow(parsedTasks);
    }

    this.generatedSchedule = scheduled;

    // 渲染预览界面
    this.previewSlotsList.innerHTML = '';
    scheduled.forEach(t => {
      const catInfo = CATEGORY_MAP[t.category] || CATEGORY_MAP.deep_work;
      const el = document.createElement('div');
      el.className = 'preview-slot-item';
      el.innerHTML = `
        <span class="preview-slot-time">${t.startTime} ~ ${t.endTime}</span>
        <span style="font-weight:700;">${this.escapeHtml(t.title)}</span>
        <span class="task-category-pill ${catInfo.class}">${catInfo.emoji} ${catInfo.name}</span>
      `;
      this.previewSlotsList.appendChild(el);
    });

    if (this.previewSummaryBadge) {
      this.previewSummaryBadge.innerText = `已解析 ${parsedTasks.length} 项用户任务 · 100% 完整排布`;
    }

    this.schedulePreviewBox.style.display = 'block';
    this.confirmApplyPlanBtn.style.display = 'inline-flex';
    this.previewPlanBtn.style.display = 'none';

    const modeDesc = isTomorrowMode ? '明日全天' : '此时刻即时';
    this.showToast(`🧠 已按【${modeDesc}】模式生成科学排程！`);
  }

  // 模式一：从发送的这一刻起立即开始执行并倒计时 (白天即刻排程)
  slotTasksFromNow(tasks) {
    const now = new Date();
    const curH = String(now.getHours()).padStart(2, '0');
    const curM = String(now.getMinutes()).padStart(2, '0');
    let pointer = `${curH}:${curM}`;

    const result = [];

    function addMins(timeStr, mins) {
      const [h, m] = timeStr.split(':').map(Number);
      const total = h * 60 + m + mins;
      const nh = Math.floor(total / 60) % 24;
      const nm = total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    }

    function timeToMinutes(timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    }

    let dinnerInserted = false;

    tasks.forEach((task, idx) => {
      // 跨越晚饭时段 (18:00 - 19:30) 时自动插入贴心的晚餐休整
      const pointerMins = timeToMinutes(pointer);
      if (!dinnerInserted && pointerMins >= 18 * 60 && pointerMins <= 19 * 60 + 30) {
        const dinnerEnd = addMins(pointer, 45);
        result.push({
          id: `slot-dinner-${Date.now()}`,
          title: '🍲 晚餐充能与身心重置',
          startTime: pointer,
          endTime: dinnerEnd,
          category: 'life_recharge',
          notes: '顺应消化生理节律，补充体能，放松神经系统',
          completed: false
        });
        pointer = dinnerEnd;
        dinnerInserted = true;
      }

      const taskEnd = addMins(pointer, task.durationMins);
      result.push({
        ...task,
        startTime: pointer,
        endTime: taskEnd,
        completed: false
      });

      // 任务后的科学间歇缓冲 (避免大脑连续过度疲劳)
      if (idx < tasks.length - 1) {
        const breakMins = task.durationMins >= 90 ? 15 : 10;
        const breakEnd = addMins(taskEnd, breakMins);
        result.push({
          id: `slot-break-${Date.now()}-${idx}`,
          title: '☕ 脑疲劳缓解与眼部放松',
          startTime: taskEnd,
          endTime: breakEnd,
          category: 'low_routine',
          notes: '远眺放松睫状肌、深呼吸补水，恢复前额叶神经递质',
          completed: false
        });
        pointer = breakEnd;
      } else {
        pointer = taskEnd;
      }
    });

    return result;
  }

  // 模式二：明日全天认知节律完整排布 (零遗漏算法)
  slotTasksTomorrow(tasks) {
    const wakeStr = (this.planWakeTime && this.planWakeTime.value) || '07:30';
    const result = [];

    function addMins(timeStr, mins) {
      const [h, m] = timeStr.split(':').map(Number);
      const total = h * 60 + m + mins;
      const nh = Math.floor(total / 60) % 24;
      const nm = total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    }

    // 1. 晨起唤醒
    result.push({
      id: `slot-wake-${Date.now()}`,
      title: '晨起补水、拉伸与今日计划梳理',
      startTime: wakeStr,
      endTime: addMins(wakeStr, 45),
      category: 'life_recharge',
      notes: '皮质醇唤醒期，温水唤醒肠胃与大脑，清爽启动',
      completed: false
    });

    const queue = [...tasks];

    // 2. 上午黄金攻坚窗口 (08:30 起步，分配高脑力任务)
    let curTime = '08:30';
    while (queue.length > 0 && curTime < '11:45') {
      const t = queue.shift();
      const end = addMins(curTime, t.durationMins);
      result.push({ ...t, startTime: curTime, endTime: end, completed: false });
      curTime = addMins(end, 10);
    }

    // 3. 午餐与午后小憩 (12:00 - 13:30)
    result.push({
      id: `slot-lunch-${Date.now()}`,
      title: '营养午餐与 20 分钟能量小憩 (Power Nap)',
      startTime: '12:00',
      endTime: '13:30',
      category: 'low_routine',
      notes: '顺应午后生理低谷，20分钟闭目养神，恢复下半天脑力',
      completed: false
    });

    // 4. 下午敏捷执行与二次高峰 (14:00 起步)
    curTime = '14:00';
    while (queue.length > 0 && curTime < '17:30') {
      const t = queue.shift();
      const end = addMins(curTime, t.durationMins);
      result.push({ ...t, startTime: curTime, endTime: end, completed: false });
      curTime = addMins(end, 10);
    }

    // 5. 晚餐生活休整 (18:00 - 19:15)
    result.push({
      id: `slot-dinner-${Date.now()}`,
      title: '晚餐充能与生活休整',
      startTime: '18:00',
      endTime: '19:15',
      category: 'life_recharge',
      notes: '放下工作学习，享受美食与生活',
      completed: false
    });

    // 6. 晚间复盘与剩余任务消化 (19:30 起步，彻底消化全部剩余任务，绝不丢弃)
    curTime = '19:30';
    while (queue.length > 0) {
      const t = queue.shift();
      const end = addMins(curTime, t.durationMins);
      result.push({ ...t, startTime: curTime, endTime: end, completed: false });
      curTime = addMins(end, 10);
    }

    // 7. 睡前放松与明日计划
    result.push({
      id: `slot-night-${Date.now()}`,
      title: '🌙 睡前放松与明日计划',
      startTime: '22:00',
      endTime: '22:30',
      category: 'review_winddown',
      notes: '清空杂念，远离屏幕，安心睡眠',
      completed: false
    });

    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // ----------------------------------------------------
  // 应用排程并立即生效 (如果即刻模式则秒开倒计时)
  // ----------------------------------------------------
  applyGeneratedSchedule() {
    if (!this.generatedSchedule || this.generatedSchedule.length === 0) return;
    this.tasks = this.generatedSchedule;
    this.saveTasks();
    this.renderAll();
    this.closeEveningModal();

    if (this.currentSchedulingMode === 'now') {
      // 即刻启动计时器
      this.resetTimer();
      this.toggleTimer();
      this.playBellChime();
      const firstTask = this.tasks[0];
      this.showToast(`🚀 已从此时刻开启日程！首项「${firstTask.title}」已进入倒计时！`);
    } else {
      this.showToast('🚀 明日全天认知节律日程已成功载入！');
    }
  }

  // ----------------------------------------------------
  // 📥 导入 AI 对话规划日程
  // ----------------------------------------------------
  handleDoImport() {
    const raw = this.importJsonInput.value.trim();
    if (!raw) {
      alert('请粘贴日程文本或代码！');
      return;
    }

    try {
      // 尝试 JSON 提取
      const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tasks = parsed.map((item, idx) => ({
            id: item.id || `import-${Date.now()}-${idx}`,
            title: item.title || '未命名任务',
            startTime: item.startTime || '09:00',
            endTime: item.endTime || '10:00',
            category: item.category || 'deep_work',
            notes: item.notes || '',
            completed: !!item.completed
          }));
          this.saveTasks();
          this.renderAll();
          this.importModal.classList.remove('active');
          this.showToast(`✅ 成功导入 ${this.tasks.length} 项日程安排！`);
          return;
        }
      }

      // 文本逐行正则解析 (支持如 "09:00 - 10:30 论文写作 [深度攻坚]")
      const lines = raw.split('\n').filter(l => l.trim().length > 0);
      const parsedTasks = [];
      lines.forEach((line, idx) => {
        const timeMatch = line.match(/(\d{1,2}[:：]\d{2})\s*[-~至到]\s*(\d{1,2}[:：]\d{2})/);
        if (timeMatch) {
          let start = timeMatch[1].replace('：', ':');
          let end = timeMatch[2].replace('：', ':');
          if (start.length === 4) start = '0' + start;
          if (end.length === 4) end = '0' + end;
          const rest = line.replace(timeMatch[0], '').replace(/[\[\]【】]/g, ' ').trim();
          let category = 'deep_work';
          if (rest.includes('敏捷') || rest.includes('会议')) category = 'agile_exec';
          if (rest.includes('运动') || rest.includes('创意')) category = 'creative_fitness';
          if (rest.includes('低谷') || rest.includes('午餐')) category = 'low_routine';
          if (rest.includes('复盘') || rest.includes('反思')) category = 'review_winddown';

          parsedTasks.push({
            id: `line-${Date.now()}-${idx}`,
            title: rest,
            startTime: start,
            endTime: end,
            category,
            notes: '来自 AI 对话规划',
            completed: false
          });
        }
      });

      if (parsedTasks.length > 0) {
        this.tasks = parsedTasks;
        this.saveTasks();
        this.renderAll();
        this.importModal.classList.remove('active');
        this.showToast(`✅ 成功解析并载入 ${parsedTasks.length} 项日程！`);
      } else {
        alert('未能识别出标准时间格式，请确保包含如 "09:00 - 10:30 任务名称" 的格式');
      }
    } catch (err) {
      alert('解析失败，请检查输入格式是否正确');
    }
  }

  // ----------------------------------------------------
  // ➕ 单项任务添加与编辑
  // ----------------------------------------------------
  openTaskEditModal(task) {
    if (task) {
      this.editModalTitle.innerText = '编辑日程任务';
      this.editTaskId.value = task.id;
      this.editTaskTitle.value = task.title;
      this.editTaskStart.value = task.startTime;
      this.editTaskEnd.value = task.endTime;
      this.editTaskCategory.value = task.category;
      this.editTaskNotes.value = task.notes || '';
    } else {
      this.editModalTitle.innerText = '添加新日程任务';
      this.editTaskId.value = '';
      this.editTaskTitle.value = '';
      this.editTaskStart.value = '09:00';
      this.editTaskEnd.value = '10:00';
      this.editTaskCategory.value = 'deep_work';
      this.editTaskNotes.value = '';
    }
    this.taskEditModal.classList.add('active');
  }

  handleSaveTaskForm(e) {
    e.preventDefault();
    const id = this.editTaskId.value;
    const title = this.editTaskTitle.value.trim();
    const startTime = this.editTaskStart.value;
    const endTime = this.editTaskEnd.value;
    const category = this.editTaskCategory.value;
    const notes = this.editTaskNotes.value.trim();

    if (!title) return;

    if (id) {
      const existing = this.tasks.find(t => t.id === id);
      if (existing) {
        existing.title = title;
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.category = category;
        existing.notes = notes;
      }
    } else {
      this.tasks.push({
        id: `custom-${Date.now()}`,
        title,
        startTime,
        endTime,
        category,
        notes,
        completed: false
      });
    }

    this.saveTasks();
    this.renderAll();
    this.taskEditModal.classList.remove('active');
    this.showToast('✅ 任务已保存！');
  }

  loadDemoSchedule() {
    this.tasks = this.getDefaultTasks();
    this.saveTasks();
    this.renderAll();
    this.showToast('🪄 已载入示范脑科学日程');
  }

  // ----------------------------------------------------
  // 辅助通知与 Service Worker
  // ----------------------------------------------------
  showToast(msg) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW failed:', e));
      });
    }
  }
}

// 启动应用实例
window.addEventListener('DOMContentLoaded', () => {
  window.schedulerApp = new BrainRhythmScheduler();
});
