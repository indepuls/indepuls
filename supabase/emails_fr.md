# Emails Supabase d'Indépuls, en français

À coller dans **Supabase, Authentication, Emails, Templates** (un modèle à la fois). Pour chacun : le champ **Subject** (objet) et le champ **Message body** (corps, en HTML). Les éléments entre doubles accolades, comme `{{ .ConfirmationURL }}`, sont remplis par Supabase : ne les modifiez pas.

Ton : vouvoiement chaleureux. Couleurs de la marque : bleu marine `#141538`, prune `#5B2C4A`, crème `#F1EFEA`, beige `#BB9E81`. Aucune image (un email sans image s'affiche partout et arrive mieux en boîte de réception).

Les modèles utilisés par Indépuls : **Confirm sign up**, **Reset password**, **Change email address**. Les deux autres (Magic link, Reauthentication) ne servent pas aujourd'hui, mais les remplir évite un email en anglais le jour où ils seront utilisés. **Invite user** n'est pas utilisé (les invitations d'associé·es partent de votre messagerie).

---

## 1. Confirm sign up (confirmation de la création du compte)

**Subject :**

```
Bienvenue sur Indépuls : confirmez votre adresse email
```

**Message body :**

```html
<div style="background:#F1EFEA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#141538">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid #5B2C4A">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#141538;margin-bottom:18px">Indépuls</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;margin:0 0 14px;color:#141538">Bienvenue, et merci de votre confiance</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Votre compte Indépuls est presque prêt. Il ne reste qu'une étape : confirmer votre adresse email, pour que nous soyons sûrs que c'est bien vous.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#5B2C4A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:8px;display:inline-block">Confirmer mon adresse email</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0 0 6px">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="font-size:12px;line-height:1.5;color:#5B2C4A;word-break:break-all;margin:0 0 18px">{{ .ConfirmationURL }}</p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0">Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet email : rien ne sera créé sans votre confirmation.</p>
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0 14px">
    <p style="font-size:12px;color:#888;margin:0">Une question ? Écrivez-nous à <a href="mailto:contact@indepuls.fr" style="color:#5B2C4A">contact@indepuls.fr</a>. Nous répondons avec plaisir.</p>
  </div>
</div>
```

---

## 2. Reset password (mot de passe oublié)

**Subject :**

```
Réinitialisez votre mot de passe Indépuls
```

**Message body :**

```html
<div style="background:#F1EFEA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#141538">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid #5B2C4A">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#141538;margin-bottom:18px">Indépuls</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;margin:0 0 14px;color:#141538">Un nouveau mot de passe, en un clic</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Vous avez demandé à réinitialiser votre mot de passe. Pas d'inquiétude, cela arrive à tout le monde : cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#5B2C4A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:8px;display:inline-block">Choisir un nouveau mot de passe</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0 0 6px">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="font-size:12px;line-height:1.5;color:#5B2C4A;word-break:break-all;margin:0 0 18px">{{ .ConfirmationURL }}</p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0">Vous n'avez rien demandé ? Ignorez cet email : votre mot de passe actuel reste inchangé et vos données sont en sécurité.</p>
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0 14px">
    <p style="font-size:12px;color:#888;margin:0">Une question ? Écrivez-nous à <a href="mailto:contact@indepuls.fr" style="color:#5B2C4A">contact@indepuls.fr</a>.</p>
  </div>
</div>
```

---

## 3. Change email address (changement d'adresse email)

**Subject :**

```
Confirmez votre nouvelle adresse email Indépuls
```

**Message body :**

```html
<div style="background:#F1EFEA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#141538">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid #5B2C4A">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#141538;margin-bottom:18px">Indépuls</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;margin:0 0 14px;color:#141538">Changement d'adresse email</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Vous avez demandé à remplacer l'adresse <strong>{{ .Email }}</strong> par <strong>{{ .NewEmail }}</strong>. Pour valider ce changement, cliquez sur le bouton ci-dessous.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#5B2C4A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:8px;display:inline-block">Confirmer ma nouvelle adresse</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0 0 6px">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="font-size:12px;line-height:1.5;color:#5B2C4A;word-break:break-all;margin:0 0 18px">{{ .ConfirmationURL }}</p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0">Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email et contactez-nous : nous vérifierons votre compte avec vous.</p>
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0 14px">
    <p style="font-size:12px;color:#888;margin:0">Une question ? Écrivez-nous à <a href="mailto:contact@indepuls.fr" style="color:#5B2C4A">contact@indepuls.fr</a>.</p>
  </div>
</div>
```

---

## 4. Magic link (lien de connexion, non utilisé aujourd'hui)

**Subject :**

```
Votre lien de connexion Indépuls
```

**Message body :**

```html
<div style="background:#F1EFEA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#141538">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid #5B2C4A">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#141538;margin-bottom:18px">Indépuls</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;margin:0 0 14px;color:#141538">Votre lien de connexion</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Cliquez sur le bouton ci-dessous pour vous connecter à votre espace, sans mot de passe.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#5B2C4A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:8px;display:inline-block">Me connecter</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0">Vous n'avez pas demandé ce lien ? Ignorez cet email, il expirera tout seul.</p>
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0 14px">
    <p style="font-size:12px;color:#888;margin:0">Une question ? Écrivez-nous à <a href="mailto:contact@indepuls.fr" style="color:#5B2C4A">contact@indepuls.fr</a>.</p>
  </div>
</div>
```

---

## 5. Reauthentication (code de vérification, non utilisé aujourd'hui)

**Subject :**

```
Votre code de vérification Indépuls
```

**Message body :**

```html
<div style="background:#F1EFEA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#141538">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;border-top:4px solid #5B2C4A">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#141538;margin-bottom:18px">Indépuls</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;margin:0 0 14px;color:#141538">Votre code de vérification</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Pour confirmer qu'il s'agit bien de vous, saisissez ce code :</p>
    <p style="text-align:center;font-size:30px;letter-spacing:6px;font-weight:bold;color:#5B2C4A;margin:22px 0">{{ .Token }}</p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0">Vous n'avez rien demandé ? Ignorez cet email.</p>
    <hr style="border:none;border-top:1px solid #E5E0D8;margin:24px 0 14px">
    <p style="font-size:12px;color:#888;margin:0">Une question ? Écrivez-nous à <a href="mailto:contact@indepuls.fr" style="color:#5B2C4A">contact@indepuls.fr</a>.</p>
  </div>
</div>
```

---

## Après avoir collé

1. Cliquez sur **Save changes** pour chaque modèle.
2. Testez la confirmation : créez un compte avec une adresse `+test` de votre Gmail (par exemple `prenom+test1@gmail.com`) et vérifiez l'email reçu.
3. Testez « mot de passe oublié » depuis la page de connexion.
4. L'expéditeur reste `contact@indepuls.fr` (réglé dans Authentication, SMTP Settings, via Brevo).
