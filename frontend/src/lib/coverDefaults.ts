import type { CoverLabel } from './types'

/**
 * 封面内置默认值（服务端没存过自定义配置时使用）。
 *
 * 每条线的两端遮罩距离(单位 px)，用于在 mask-image 渐变中让两端透明：
 *   hideStart: 起点端(中心/About me 方向)隐藏距离，加大 → 离 About me 更远
 *   hideEnd:   终点端(文字方向)隐藏距离，加大 → 离文字更远；默认 0 → 精确对齐文字中点
 */
export const DEFAULT_COVER_TITLE = 'About me'
export const DEFAULT_COVER_HINT = '(点击任意处进入问答页)'
/** 线宽(CSS px)。浏览器会把线宽按整设备像素对齐，1.5 与 1.48 的渲染结果一致 */
export const DEFAULT_COVER_LINE_WIDTH = 1.5
/** 可调线宽区间：0 = 不显示连线；步进 0.05（浏览器会把线宽取整到整像素，见编辑面板里的说明） */
export const COVER_LINE_WIDTH_MIN = 0
export const COVER_LINE_WIDTH_MAX = 2
export const COVER_LINE_WIDTH_STEP = 0.05

export const clampLineWidth = (value: number) => {
  const v = Number.isFinite(value) ? value : DEFAULT_COVER_LINE_WIDTH
  return Math.min(COVER_LINE_WIDTH_MAX, Math.max(COVER_LINE_WIDTH_MIN, v))
}

/**
 * 连线的参考视口：labels 里的 hideStart / hideEnd（以及编辑器里的滑杆）
 * 都是按这个尺寸量出来的像素值，其它分辨率下按线长等比换算。
 */
export const COVER_REF_WIDTH = 1002
export const COVER_REF_HEIGHT = 945
export const COVER_CENTER_X = 50
export const COVER_CENTER_Y = 53

/** 某条小字在参考视口下离中心的距离(px)，用来把 hideStart/hideEnd 换算成比例 */
export const referenceLineLength = (label: { x: number; y: number }) =>
  Math.hypot(
    ((label.x - COVER_CENTER_X) / 100) * COVER_REF_WIDTH,
    ((label.y - COVER_CENTER_Y) / 100) * COVER_REF_HEIGHT,
  )

export const DEFAULT_COVER_LABELS: CoverLabel[] = [
  { text: '性格', x: 30, y: 15, hideStart: 100, hideEnd: 10 },
  { text: '口味', x: 49.2, y: 7.4, hideStart: 65, hideEnd: 10 },
  { text: '校园经历', x: 87.3, y: 8.5, hideStart: 120, hideEnd: 20 },
  { text: '音乐品味', x: 8, y: 20, hideStart: 220, hideEnd: 15 },
  { text: '爱好', x: 60, y: 28.7, hideStart: 100, hideEnd: 18 },
  { text: '项目经历', x: 91.5, y: 34.0, hideStart: 255, hideEnd: 30 },
  { text: '职业规划', x: 90.8, y: 65, hideStart: 110, hideEnd: 33 },
  { text: 'MBTI', x: 70.8, y: 65.4, hideStart: 100, hideEnd: 20 },
  { text: '联系方式', x: 49.6, y: 72.9, hideStart: 32, hideEnd: 10 },
  { text: '社交', x: 70, y: 81.9, hideStart: 70, hideEnd: 18 },
  { text: '体质特征', x: 58, y: 85.1, hideStart: 50, hideEnd: 10 },
  { text: '星座', x: 29.2, y: 86.7, hideStart: 55, hideEnd: 10 },
  { text: '特长', x: 16.5, y: 65, hideStart: 105, hideEnd: 19 },
]

/** 新增小字时按索引在中心外围撒开，避免和已有小字叠在一起 */
export const nextLabelPosition = (index: number): { x: number; y: number } => {
  const angle = ((index % 12) * 55 + 20) * (Math.PI / 180)
  return {
    x: Number((50 + 33 * Math.cos(angle)).toFixed(2)),
    y: Number((53 + 31 * Math.sin(angle)).toFixed(2)),
  }
}
