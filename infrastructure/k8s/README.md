# Kubernetes Baseline (Helm)

Helm chart baseline nằm tại `infrastructure/k8s/helm/tracking-platform`.

## Baseline manifests đã có
- Deployments + Services cho 6 service chính
- Ingress cho `gateway` (`templates/ingress.yaml`)
- ConfigMap dùng chung (`templates/configmap.yaml`)
- Secret (tạo có điều kiện) (`templates/secret.yaml`)
- NetworkPolicy baseline (`templates/networkpolicy.yaml`)

## Values quan trọng
- `ingress.enabled`: bật/tắt ingress
- `config.create`, `config.existingConfigMap`: tạo mới hoặc dùng configmap có sẵn
- `secrets.create`, `secrets.existingSecret`: tạo mới hoặc dùng secret có sẵn
- `networkPolicy.enabled`: bật/tắt baseline network policies

## Validate chart
```bash
helm lint infrastructure/k8s/helm/tracking-platform \
  -f infrastructure/k8s/helm/tracking-platform/values.yaml \
  -f infrastructure/k8s/environments/dev/values.yaml
```

## Render manifest theo môi trường
```bash
helm template tracking-dev infrastructure/k8s/helm/tracking-platform \
  -f infrastructure/k8s/helm/tracking-platform/values.yaml \
  -f infrastructure/k8s/environments/dev/values.yaml
```

## Deploy
```bash
helm upgrade --install tracking-dev infrastructure/k8s/helm/tracking-platform \
  --namespace tracking \
  --create-namespace \
  -f infrastructure/k8s/helm/tracking-platform/values.yaml \
  -f infrastructure/k8s/environments/dev/values.yaml
```

## Ví dụ dùng secret có sẵn (khuyến nghị)
```bash
kubectl -n tracking create secret generic tracking-platform-secrets \
  --from-literal=AUTH_INTERNAL_API_KEY=replace-me \
  --from-literal=AUTH_TOKEN_HASH_PEPPER=replace-me
```

`infrastructure/k8s/environments/<env>/values.yaml`:
```yaml
secrets:
  create: false
  existingSecret: tracking-platform-secrets
```
