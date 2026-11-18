/**
 * Reduz uma foto escolhida pelo usuário antes de guardar.
 * Na demonstração as fotos ficam no navegador (que tem pouco espaço), então a imagem vira um
 * JPEG de no máximo `ladoMaximo` pixels no lado maior (cerca de 60–150 KB).
 * Com o backend, a foto original iria para o servidor.
 */
export async function reduzirFoto(arquivo: File, ladoMaximo = 900, qualidade = 0.72): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (JPG, PNG ou similar).');
  }
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
  const largura = Math.round(imagem.width * escala);
  const altura = Math.round(imagem.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');
  ctx.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();
  return canvas.toDataURL('image/jpeg', qualidade);
}
