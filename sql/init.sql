-- 知识库 RAG 系统初始化建表脚本
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS knowledge_rag
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE knowledge_rag;

-- 文档表
CREATE TABLE IF NOT EXISTS documents (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL COMMENT '原始文件名',
  file_path   VARCHAR(500) NOT NULL COMMENT '服务器存储路径',
  file_size   INT          DEFAULT 0 COMMENT '文件大小（字节）',
  file_type   VARCHAR(50)  DEFAULT '' COMMENT '文件类型扩展名',
  chunk_count INT          DEFAULT 0 COMMENT '分块数量',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档表';

-- 文本块表
CREATE TABLE IF NOT EXISTS chunks (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  document_id   INT          NOT NULL COMMENT '所属文档ID',
  chunk_index   INT          DEFAULT 0 COMMENT '块序号',
  chunk_text    TEXT         NOT NULL COMMENT '文本内容',
  embedding     JSON         DEFAULT NULL COMMENT '向量数据',
  metadata_json JSON         DEFAULT NULL COMMENT '元数据（页码等）',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文本块表';

-- 索引
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
