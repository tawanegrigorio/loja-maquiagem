
import { useEffect, useState } from 'react'
import api from './services/api'
import './App.css'
import Hero from './Hero'


interface IProducts {
    id: number
    name: string
    price: number
    stock: number
    category: string
    image?: string
}

interface ICartItem {
    product: IProducts
    quantity: number
}
interface IViaCepResponse {
    cep: string
    logradouro: string
    bairro: string
    localidade: string
    uf: string
    erro?: boolean
}

interface ICepRange {
    inicio: string
    fim: string
}

function App() {
    const [carrinhoAberto, setCarrinhoAberto] = useState(false)
    const [products, setProducts] = useState<IProducts[]>([])
    const [cart, setCart] = useState<ICartItem[]>([])
    const [busca, setBusca] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [compraFinalizada, setCompraFinalizada] = useState(false)
    const [pagamentoAberto, setPagamentoAberto] = useState(false)
    const [metodoPagamento, setMetodoPagamento] = useState<'cartao' | 'pix'>('cartao')
    const [cep, setCep] = useState('')
    const [consultandoCep, setConsultandoCep] = useState(false)
    const [endereco, setEndereco] = useState<IViaCepResponse | null>(null)
    const [mensagemEntrega, setMensagemEntrega] = useState('')
    const [entregaDisponivel, setEntregaDisponivel] = useState(false)
    const FRETE_PADRAO = 15
    const VALOR_FRETE_GRATIS = 200
    const FAIXAS_CEP_ATENDIDAS: ICepRange[] = [
        {
            inicio: '01000000',
            fim: '05999999',
        },
        {
            inicio: '08000000',
            fim: '08499999',
        },
    ]
    useEffect(() => {
        api.get<IProducts[]>('/produtos')
            .then(response => {
                setProducts(response.data)
            })
            .catch(() => {
                setError('Não foi possível carregar os produtos.')
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    function addToCart(product: IProducts) {
        setCart(currentCart => {
            const item = currentCart.find(
                item => item.product.id === product.id
            )

            if (item) {
                if (item.quantity >= product.stock) {
                    return currentCart
                }

                return currentCart.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }

            if (product.stock <= 0) {
                return currentCart
            }

            return [...currentCart, { product, quantity: 1 }]
        })
    }

    function removeFromCart(productId: number) {
        setCart(currentCart =>
            currentCart.filter(item => item.product.id !== productId)
        )
    }
    function atualizarQuantidade(productId: number, novaQuantidade: number) {
        setCart(carrinhoAtual =>
            carrinhoAtual.map(item => {
                if (item.product.id !== productId) return item

                const quantidadeValida = Math.min(
                    Math.max(novaQuantidade || 1, 1),
                    item.product.stock
                )

                return { ...item, quantity: quantidadeValida }
            })
        )
    }
    function finalizarCompra() {
        setProducts(produtosAtuais =>
            produtosAtuais.map(product => {
                const itemComprado = cart.find(item => item.product.id === product.id)

                if (!itemComprado) return product

                return {
                    ...product,
                    stock: Math.max(product.stock - itemComprado.quantity, 0),
                }
            })
        )

        setCart([])
        setCompraFinalizada(true)
    }
    const produtosFiltrados = products.filter(product =>
        product.name.toLowerCase().includes(busca.toLowerCase()) ||
        product.category.toLowerCase().includes(busca.toLowerCase())
    )
    const cartQuantity = cart.reduce(
        (total, item) => total + item.quantity,
        0
    )

    const cartTotal = cart.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0
    )

    const valorFrete =
        cart.length > 0 && entregaDisponivel
            ? cartTotal >= VALOR_FRETE_GRATIS
                ? 0
                : FRETE_PADRAO
            : 0

    const totalComFrete = cartTotal + valorFrete

    function normalizarCep(valor: string) {
        return valor.replace(/\D/g, '').slice(0, 8)
    }

    function cepEstaNaCobertura(cepConsultado: string) {
        return FAIXAS_CEP_ATENDIDAS.some(({ inicio, fim }) => {
            const cepInicial = normalizarCep(inicio)
            const cepFinal = normalizarCep(fim)

            return (
                cepConsultado >= cepInicial &&
                cepConsultado <= cepFinal
            )
        })
    }

    async function consultarEntrega() {
        const cepNumerico = normalizarCep(cep)

        setEndereco(null)
        setEntregaDisponivel(false)
        setMensagemEntrega('')

        if (cepNumerico.length !== 8) {
            setMensagemEntrega(
                'Informe um CEP válido com 8 dígitos.'
            )
            return
        }

        setConsultandoCep(true)

        try {
            const response = await fetch(
                `https://viacep.com.br/ws/${cepNumerico}/json/`
            )

            if (!response.ok) {
                throw new Error('Erro ao consultar o CEP')
            }

            const dados: IViaCepResponse = await response.json()

            if (dados.erro) {
                setMensagemEntrega(
                    'CEP não encontrado. Confira os números e tente novamente.'
                )
                return
            }

            setEndereco(dados)

            if (dados.uf !== 'SP') {
                setMensagemEntrega(
                    'No momento, não realizamos entregas para este estado.'
                )
                return
            }

            if (!cepEstaNaCobertura(cepNumerico)) {
                setMensagemEntrega(
                    'Infelizmente, ainda não realizamos entregas para esta região.'
                )
                return
            }

            setEntregaDisponivel(true)

            setMensagemEntrega(
                `Entrega disponível para ${dados.localidade} - ${dados.uf}.`
            )
        } catch {
            setMensagemEntrega(
                'Não foi possível consultar o CEP agora. Tente novamente.'
            )
        } finally {
            setConsultandoCep(false)
        }
    }
    return (
        <main>
            <Hero setCarrinhoAberto={setCarrinhoAberto} />

            <section id="produtos" className="products-section">
                <div className="section-heading">
                    <div className="products-heading-title">
                        <h2>Produtos</h2>
                    </div>

                    <button
                        className="cart-link"
                        onClick={() => setCarrinhoAberto(true)}
                    >
                        <span>Ver carrinho</span>
                        <span className="cart-count">{cartQuantity}</span>
                    </button>
                </div>

                <label className="product-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                        type="search"
                        placeholder="Buscar produtos"
                        value={busca}
                        onChange={event => setBusca(event.target.value)}
                        aria-label="Buscar produtos"
                    />
                </label>

                {loading && <p>Carregando produtos...</p>}
                {error && <p>{error}</p>}

                {!loading && !error && (
                    <div className="products">
                        {produtosFiltrados.map(product => (
                            <article
                                key={product.id}
                                className="product-card"
                            >
                                <div className="product-image-box">
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="product-image"
                                        />
                                    ) : (
                                        <div className="image-placeholder">
                                            Sem imagem
                                        </div>
                                    )}
                                </div>

                                <p className="product-category">
                                    {product.category}
                                </p>

                                <h3>{product.name}</h3>
                                <div className="product-rating">
                                    <span className="rating-stars">
                                        {'★'.repeat(Math.round(3.8 + (product.id % 13) / 10))}
                                        {'☆'.repeat(5 - Math.round(3.8 + (product.id % 13) / 10))}
                                    </span>

                                    <span className="rating-score">
                                        {(3.8 + (product.id % 13) / 10)
                                            .toFixed(1)
                                            .replace('.', ',')}/5
                                    </span>
                                </div>
                                <p className="product-price">
                                    {product.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    })}
                                </p>


                                {product.stock > 0 && product.stock < 5 && (
                                    <p className="low-stock">
                                        Restam {product.stock} unidades
                                    </p>
                                )}

                                {product.stock <= 0 && (
                                    <p className="out-of-stock">
                                        Produto esgotado
                                    </p>
                                )}

                                <button
                                    className="add-cart-button"
                                    onClick={() => {
                                        addToCart(product)
                                        setCarrinhoAberto(true)
                                    }}
                                    disabled={product.stock <= 0}
                                >
                                    Adicionar ao carrinho

                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section id="sobre" className="about-section">
                <div className="about-video">
                    <video
                        src="/video/video.mp4"
                        poster="/imagens/capa.jpg"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                    />
                </div>

                <div className="about-content">
                    <p className="about-eyebrow">NOSSA ESSÊNCIA</p>

                    <h2>
                        Beleza que inspira
                        <span> confiança.</span>
                    </h2>

                    <div className="about-divider"></div>

                    <p className="about-description">
                        A CosBEAUTY acredita que a beleza está na liberdade de ser quem você é.
                        Mais do que maquiagem, oferecemos uma forma de expressão, confiança e autenticidade.
                    </p>

                    <p className="about-description">
                        Cada produto é um convite para explorar novas cores,
                        valorizar seus traços e transformar pequenos momentos em experiências especiais.
                        Acreditamos que não existe uma única maneira de ser bonita — existe a sua maneira.
                    </p>
                    <p className="about-description">
                        Nossa essência está nos detalhes, na elegância e na individualidade de cada pessoa.
                        Porque a maquiagem não precisa transformar quem você é,
                        mas revelar ainda mais aquilo que faz você ser única.
                    </p>

                    <p className="about-signature">
                        COSBEAUTY
                    </p>
                </div>
            </section>

            <footer className="site-footer">
                <div className="footer-container">
                    <div className="footer-top">
                        <div className="footer-brand">
                            <a href="#produtos" className="footer-logo">
                                Cos<span>BEAUTY</span>
                            </a>
                            <p>Maquiagem, skincare e cuidados para sua rotina.</p>
                        </div>

                        <div className="footer-column">
                            <h3>Atendimento</h3>
                            <a href="#contato">Fale conosco</a>
                            <a href="#trocas">Trocas e devoluções</a>
                            <a href="#privacidade">Política de privacidade</a>
                            <a href="#termos">Termos de uso</a>
                        </div>

                        <div className="footer-column">
                            <h3>Departamentos</h3>
                            <a href="#produtos">Maquiagem</a>
                            <a href="#produtos">Mais vendidos</a>
                            <a href="#produtos">Novidades</a>
                        </div>

                        <div className="footer-column">
                            <h3>Minha conta</h3>
                            <a href="#conta">Meus dados</a>
                            <a href="#pedidos">Meus pedidos</a>
                            <a href="#carrinho">Meu carrinho</a>
                        </div>

                        <div className="footer-social">
                            <h3>Acompanhe a CosBEAUTY</h3>
                            <p>Novidades e lançamentos da marca.</p>
                            <div className="footer-social-links">
                                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
                                <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a>
                            </div>
                        </div>
                    </div>

                    <div className="footer-payment">
                        <div>
                            <h3>Pagamento</h3>
                            <p>Consulte as opções disponíveis na finalização da compra.</p>
                        </div>

                        <div>
                            <h3>Segurança</h3>
                            <p>Compre com atenção e confira os dados do pedido antes de concluir.</p>
                        </div>
                    </div>

                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} CosBEAUTY. Todos os direitos reservados (Este site é meramente ilustrativo, obrigada por chegar até aqui.)</p>
                        <a href="#produtos">Voltar ao início ↑</a>
                    </div>
                </div>
            </footer>


            {carrinhoAberto && (
                <div
                    className="cart-overlay"
                    onClick={() => setCarrinhoAberto(false)}
                >
                    <section
                        id="carrinho"
                        className="cart-sidebar"
                        onClick={event => event.stopPropagation()}
                    >

                        {compraFinalizada ? (
                            <div className="purchase-success">
                                <span className="success-check">✓</span>

                                <h2>Compra realizada!</h2>

                                <p>
                                    Obrigada por confiar na CosBEAUTY.
                                </p>

                                <button
                                    className="payment-submit"
                                    onClick={() => {
                                        setCompraFinalizada(false)
                                        setPagamentoAberto(false)
                                        setCarrinhoAberto(false)

                                    }}
                                >
                                    Continuar explorando
                                </button>
                            </div>
                        ) : pagamentoAberto ? (
                            <>

                                <button
                                    className="payment-back"
                                    onClick={() => setPagamentoAberto(false)}
                                >
                                    ← Voltar ao carrinho
                                </button>

                                <p className="section-eyebrow">PAGAMENTO</p>

                                <h2>Pagamento</h2>

                                <p className="payment-subtitle">
                                    Escolha uma forma de pagamento.
                                </p>

                                <div className="payment-methods">
                                    <button
                                        type="button"
                                        className={
                                            metodoPagamento === 'cartao'
                                                ? 'payment-method active'
                                                : 'payment-method'
                                        }
                                        onClick={() => setMetodoPagamento('cartao')}
                                    >
                                        Cartão de crédito
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            metodoPagamento === 'pix'
                                                ? 'payment-method active'
                                                : 'payment-method'
                                        }
                                        onClick={() => setMetodoPagamento('pix')}
                                    >
                                        Pix
                                    </button>
                                </div>

                                {metodoPagamento === 'cartao' ? (
                                    <div className="payment-fields">
                                        <label>Nome no cartão</label>
                                        <input
                                            type="text"
                                            placeholder="Nome do titular"
                                        />

                                        <label>Número do cartão</label>
                                        <input
                                            type="text"
                                            placeholder="0000 0000 0000 0000"
                                            maxLength={19}
                                        />

                                        <div className="payment-row">
                                            <div>
                                                <label>Validade</label>
                                                <input
                                                    type="text"
                                                    placeholder="MM/AA"
                                                    maxLength={5}
                                                />
                                            </div>

                                            <div>
                                                <label>Parcelas</label>
                                                <select>
                                                    <option>1x sem juros</option>
                                                    <option>2x sem juros</option>
                                                    <option>3x sem juros</option>
                                                </select>
                                            </div>
                                        </div>

                                        <p className="payment-demo-note">
                                            Demonstração apenas. Não informe dados reais.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pix-demo">
                                        <div className="pix-symbol">◇</div>

                                        <h3>Pagamento via Pix</h3>

                                        <p>
                                            Esta área representa o pagamento via Pix.
                                        </p>

                                        <div className="pix-placeholder">
                                            QR Code ilustrativo
                                        </div>

                                        <p className="payment-demo-note">
                                            Nenhuma transação será realizada.
                                        </p>
                                    </div>

                                )}
                                <button
                                    className="payment-submit"
                                    onClick={finalizarCompra}
                                >
                                    Finalizar compra
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="close-cart"
                                    onClick={() => setCarrinhoAberto(false)}
                                >
                                    ×
                                </button>

                                <p className="section-eyebrow">SUA SELEÇÃO</p>

                                <h2>Meu carrinho</h2>

                                {cart.length === 0 ? (
                                    <div className="empty-cart">
                                        <p>Seu carrinho está vazio.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="cart-items">
                                            {cart.map(item => (
                                                <div
                                                    className="cart-item"
                                                    key={item.product.id}
                                                >
                                                    <div>
                                                        <h3>{item.product.name}</h3>

                                                        <label className="cart-quantity">
                                                            Quantidade:
                                                            <select
                                                                value={item.quantity}
                                                                onChange={event =>
                                                                    atualizarQuantidade(item.product.id, Number(event.target.value))
                                                                }
                                                            >
                                                                {Array.from(
                                                                    { length: Math.min(item.product.stock, 50) },
                                                                    (_, index) => index + 1
                                                                ).map(numero => (
                                                                    <option key={numero} value={numero}>
                                                                        {numero}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>

                                                    <strong>
                                                        {(item.product.price * item.quantity).toLocaleString(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            }
                                                        )}
                                                    </strong>

                                                    <button
                                                        onClick={() =>
                                                            removeFromCart(item.product.id)
                                                        }
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="delivery-check">
                                            <label htmlFor="cep-entrega">
                                                Consulte a entrega pelo CEP
                                            </label>

                                            <div className="delivery-cep-row">
                                                <input
                                                    id="cep-entrega"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={cep}
                                                    maxLength={8}
                                                    placeholder="Digite seu CEP"
                                                    onChange={event => {
                                                        const novoCep = normalizarCep(event.target.value)

                                                        setCep(novoCep)
                                                        setEndereco(null)
                                                        setEntregaDisponivel(false)
                                                        setMensagemEntrega('')
                                                    }}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={consultarEntrega}
                                                    disabled={consultandoCep}
                                                >
                                                    {consultandoCep ? 'Consultando...' : 'Consultar'}
                                                </button>
                                            </div>

                                            {endereco && (
                                                <p className="delivery-address">
                                                    {endereco.logradouro}
                                                    {endereco.bairro ? `, ${endereco.bairro}` : ''}
                                                    {' — '}
                                                    {endereco.localidade} - {endereco.uf}
                                                </p>
                                            )}

                                            {mensagemEntrega && (
                                                <p
                                                    className={
                                                        entregaDisponivel
                                                            ? 'delivery-message is-available'
                                                            : 'delivery-message is-error'
                                                    }
                                                >
                                                    {mensagemEntrega}
                                                </p>
                                            )}
                                        </div>

                                        <div className="shipping-summary">
                                            <p>
                                                <span>Subtotal</span>

                                                <strong>
                                                    {cartTotal.toLocaleString('pt-BR', {
                                                        style: 'currency',
                                                        currency: 'BRL',
                                                    })}
                                                </strong>
                                            </p>

                                            <p>
                                                <span>Frete</span>

                                                <strong>
                                                    {!cart.length
                                                        ? '—'
                                                        : !entregaDisponivel
                                                            ? 'Consulte o CEP'
                                                            : valorFrete === 0
                                                                ? 'Grátis'
                                                                : valorFrete.toLocaleString(
                                                                    'pt-BR',
                                                                    {
                                                                        style: 'currency',
                                                                        currency: 'BRL',
                                                                    }
                                                                )}
                                                </strong>
                                            </p>

                                            <p className="shipping-grand-total">
                                                <span>Total</span>

                                                <strong>
                                                    {totalComFrete.toLocaleString('pt-BR', {
                                                        style: 'currency',
                                                        currency: 'BRL',
                                                    })}
                                                </strong>
                                            </p>
                                            <button
                                                className="payment-submit"
                                                onClick={() => {

                                                    if (!entregaDisponivel) {
                                                        setMensagemEntrega(
                                                            'Consulte um CEP de uma região atendida antes de finalizar a compra.'
                                                        )
                                                        return
                                                    }

                                                    setPagamentoAberto(true)
                                                    { finalizarCompra }
                                                }}
                                            >
                                                Fechar compra
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}

export default App

