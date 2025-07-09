# デプロイ手順

## 前提条件
- GitHubリポジトリの作成
- Netlifyアカウント
- Renderアカウント

## 1. GitHubへのプッシュ

```bash
# GitHubでリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin master
```

## 2. Renderでサーバーをデプロイ

1. [Render](https://render.com) にログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続
4. 設定：
   - **Name**: `webrtc-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

5. 環境変数を設定：
   - `NODE_ENV` = `production`
   - `CLIENT_URL` = `https://YOUR_NETLIFY_DOMAIN.netlify.app`

6. 「Create Web Service」をクリック

## 3. Netlifyでフロントエンドをデプロイ

1. [Netlify](https://netlify.com) にログイン
2. 「New site from Git」を選択
3. GitHubリポジトリを接続
4. 設定：
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`

5. 環境変数を設定：
   - `VITE_SERVER_URL` = `https://YOUR_RENDER_DOMAIN.onrender.com`

6. 「Deploy site」をクリック

## 4. 設定の更新

1. RenderのサーバーURLをNetlifyの環境変数に設定
2. NetlifyのドメインをRenderの環境変数に設定
3. 両方のサービスを再デプロイ

## 5. HTTPS対応

- NetlifyとRenderは自動的にHTTPS証明書を提供
- WebRTCはHTTPS環境でのみ動作するため必須

## 6. 動作確認

1. Netlifyのドメインにアクセス
2. 複数のブラウザ/デバイスでテスト
3. ビデオ通話、チャット、ファイル共有の動作確認

## トラブルシューティング

### CORS エラー
- RenderでCLIENT_URLが正しく設定されているか確認
- Netlifyドメインが正確か確認

### WebRTC接続エラー
- HTTPS接続であることを確認
- STUNサーバーの設定を確認

### ファイルアップロードエラー
- Renderのディスク容量制限を確認
- 一時的なストレージのため、アップロードファイルは永続化されません