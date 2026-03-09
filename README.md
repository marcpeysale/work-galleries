# work-galleries

Plateforme de galeries photo/vidéo pour clients, construite sur AWS.

## Architecture

```
monorepo/
├── infra/              AWS CDK (TypeScript) — Cognito, API Gateway, Lambda, DynamoDB, S3, CloudFront
├── packages/
│   ├── api/            Lambdas Node.js (users, projects, media, zip)
│   ├── admin/          SPA React — back-office (gestion users, projets, médias)
│   ├── gallery/        SPA React — galerie client
│   └── shared/         Types TypeScript partagés + design tokens Tailwind
```

**Stacks CDK déployées :**

| Stack | Contenu |
|---|---|
| `GalleryAuthStack` | Cognito User Pool, groupes `admin` / `client` |
| `GalleryInfraStack` | Buckets S3 (media, exports, admin SPA, gallery SPA) + distributions CloudFront |
| `GalleryApiStack` | DynamoDB, Lambdas, API Gateway HTTP + JWT Authorizer |

---

## Prérequis

- Node.js >= 20 ([nvm](https://github.com/nvm-sh/nvm) recommandé — un `.nvmrc` est présent)
- pnpm >= 9 : `npm install -g pnpm`
- AWS CDK CLI : `npm install -g aws-cdk`
- AWS CLI configuré avec un profil ayant les droits nécessaires

---

## Installation

```bash
# Depuis la racine du monorepo
pnpm install
```

---

## Développement local

### 1. Variables d'environnement

Copier les fichiers d'exemple dans chaque SPA et les renseigner avec les valeurs des stacks déployées :

```bash
cp packages/admin/.env.example packages/admin/.env
cp packages/gallery/.env.example packages/gallery/.env
```

Contenu de chaque `.env` :

```env
VITE_USER_POOL_ID=eu-west-3_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_URL=https://xxxxxxxxxx.execute-api.eu-west-3.amazonaws.com
```

Pour retrouver ces valeurs depuis les outputs CloudFormation :

```bash
# User Pool et Client ID
aws cloudformation describe-stacks --stack-name GalleryAuthStack \
  --query "Stacks[0].Outputs" --output table

# API URL
aws cloudformation describe-stacks --stack-name GalleryApiStack \
  --query "Stacks[0].Outputs" --output table
```

### 2. Lancer les SPAs

```bash
# Back-office admin (http://localhost:5173)
pnpm --filter @gallery/admin dev

# Galerie client (http://localhost:5174)
pnpm --filter @gallery/gallery dev
```

Les deux SPAs appellent l'API Gateway déployée sur AWS. Il n'y a pas d'émulation Lambda en local.

---

## Build

### Tout builder d'un coup

```bash
pnpm build
```

### Par package

```bash
pnpm --filter @gallery/api build       # Bundle les 4 Lambdas dans packages/api/dist/
pnpm --filter @gallery/admin build     # Build Vite → packages/admin/dist/
pnpm --filter @gallery/gallery build   # Build Vite → packages/gallery/dist/
```

---

## Déploiement AWS

### Déploiement complet (première fois)

```bash
# 1. Builder les Lambdas
pnpm --filter @gallery/api build

# 2. Déployer toute l'infrastructure
cd infra
cdk deploy --all --require-approval never
```

L'ordre de déploiement est géré automatiquement par CDK via les dépendances entre stacks :
`GalleryAuthStack` → `GalleryInfraStack` → `GalleryApiStack`

### Déploiement par stack

```bash
cd infra

cdk deploy GalleryAuthStack    # Cognito uniquement
cdk deploy GalleryInfraStack   # S3 + CloudFront uniquement
cdk deploy GalleryApiStack     # DynamoDB + Lambdas + API Gateway
```

### Déployer uniquement les Lambdas (sans toucher à l'infra)

```bash
pnpm --filter @gallery/api build
cd infra && cdk deploy GalleryApiStack --require-approval never
```

### Déployer le back-office admin sur S3/CloudFront

```bash
# Récupérer le nom du bucket et l'ID de distribution
aws cloudformation describe-stacks --stack-name GalleryInfraStack \
  --query "Stacks[0].Outputs[?OutputKey=='AdminBucketName' || OutputKey=='AdminDistributionId'].OutputValue" \
  --output text

# Builder (les variables VITE_* doivent être dans packages/admin/.env)
pnpm --filter @gallery/admin build

# Synchroniser vers S3 (remplacer ACCOUNT_ID par ton ID de compte AWS)
aws s3 sync packages/admin/dist s3://gallery-admin-ACCOUNT_ID \
  --delete --cache-control "no-cache"

# Invalider le cache CloudFront (remplacer DISTRIBUTION_ID)
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

### Déployer la galerie client sur S3/CloudFront

```bash
pnpm --filter @gallery/gallery build

aws s3 sync packages/gallery/dist s3://gallery-client-ACCOUNT_ID \
  --delete --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

---

## URLs de production actuelles

| Service | URL |
|---|---|
| API Gateway | `https://poyggkduck.execute-api.eu-west-3.amazonaws.com` |
| Admin CloudFront | `https://d27t2ctekqw06l.cloudfront.net` |
| Gallery CloudFront | `https://d2ol4aorbwa1rj.cloudfront.net` |
| Media CloudFront | `https://d3vdszkm0fpmuj.cloudfront.net` |

---

## CI/CD (GitHub Actions)

Le fichier `.github/workflows/deploy.yml` déclenche un déploiement automatique sur chaque push sur `main`.

Il utilise une détection de changements par chemin :

| Changement | Jobs déclenchés |
|---|---|
| `infra/**` ou `packages/api/**` | Build API + `cdk deploy --all` |
| `packages/admin/**` | Build admin + `aws s3 sync` + invalidation CloudFront |
| `packages/gallery/**` | Build gallery + `aws s3 sync` + invalidation CloudFront |
| `packages/shared/**` | Tous les jobs |

### Secrets GitHub à configurer

Dans **Settings > Secrets and variables > Actions** du dépôt :

| Secret | Valeur |
|---|---|
| `AWS_ACCESS_KEY_ID` | Clé d'accès IAM CI/CD |
| `AWS_SECRET_ACCESS_KEY` | Secret IAM CI/CD |
| `AWS_ACCOUNT_ID` | ID du compte AWS (12 chiffres) |
| `VITE_USER_POOL_ID` | Output de `GalleryAuthStack` |
| `VITE_USER_POOL_CLIENT_ID` | Output de `GalleryAuthStack` |
| `VITE_API_URL` | Output de `GalleryApiStack` |
| `ADMIN_DISTRIBUTION_ID` | Output de `GalleryInfraStack` (`AdminDistributionId`) |
| `GALLERY_DISTRIBUTION_ID` | Output de `GalleryInfraStack` (`GalleryDistributionId`) |

---

## Commandes utiles

```bash
# Voir les changements CDK sans déployer
cd infra && cdk diff

# Voir la synthèse CloudFormation générée
cd infra && cdk synth

# Typecheck de tout le monorepo
pnpm typecheck

# Linting de tout le monorepo
pnpm lint

# Créer un utilisateur admin dans Cognito
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-3_XXXXXXXXX \
  --username marc@peysale.com \
  --user-attributes Name=email,Value=marc@peysale.com Name=given_name,Value=Marc Name=family_name,Value=Peysale \
  --desired-delivery-mediums EMAIL

aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-3_XXXXXXXXX \
  --username marc@peysale.com \
  --group-name admin
```
